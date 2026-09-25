// LinkedIn automation (D-05, OFF by default) — sends the messages LeadGennie has queued, one real LinkedIn tab at a time.
//
// RETAINED, NOT DELETED. runConnectedSync() is a no-op unless automationAllowed() (server flag on + `automation` scope +
// optional "debugger" permission granted). The server ALSO returns an empty queue while the flag is off.
import { apiFetch } from '../lib/api.js';
import { logEvent } from '../lib/log.js';
import { acquire, release } from './run-lock.js';
import { automationAllowed } from './gate.js';
import { ensureAutomationScript } from './inject.js';

// Safety caps: never let one automated pass hammer LinkedIn.
const MAX_SYNC_PER_RUN = 20;
const BETWEEN_SEND_DELAY_MS = 10000;
const TAB_CLOSE_DELAY_MS = 15000;

async function fetchQueue() {
  const data = await apiFetch('/queue');
  return data.items || [];
}

async function reportStatus(id, status, error) {
  await apiFetch('/queue', { method: 'POST', body: { id, status, error } });
}

// Resolves with the content script's raw reply instead of rejecting on a
// failed send, so the caller can inspect `navigateTo` and decide whether the
// failure is recoverable.
async function sendActionToTab(tabId, action) {
  await ensureAutomationScript(tabId); // the script is injected on demand (and again after a navigation)
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_ACTION', action }, (reply) => {
      if (chrome.runtime.lastError) {
        logEvent(`Action ${action.type} failed to reach tab ${tabId}: ${chrome.runtime.lastError.message}`, 'error');
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(reply || { success: false, error: 'No response from content script' });
    });
  });
}

function waitForTabLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    function onUpdated(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') finish();
    }
    function finish() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function sendLinkedinMessage(linkedinUrl, message) {
  if (!linkedinUrl) throw new Error("Lead has no LinkedIn URL");
  logEvent(`LinkedIn send started: ${linkedinUrl} (${message.length} chars)`, 'info');

  // Deliberately active, not background — Chrome throttles JS timers/rAF in
  // inactive tabs, and LinkedIn's own overlay-mounting logic appears to
  // depend on that (confirmed live: a hand-tested active tab produced a
  // compose box matching our selector exactly; the same selector against the
  // same kind of overlay repeatedly failed to find anything when opened via
  // an inactive background tab, even with a much longer poll). Matches what
  // Standalone Mode already does below for the same reason. Means a send
  // will briefly steal focus — a real tradeoff, not an oversight.
  const tab = await chrome.tabs.create({ url: linkedinUrl, active: true });
  logEvent(`Opened LinkedIn tab ${tab.id} for ${linkedinUrl}`, 'info');
  try {
    await new Promise((resolve) => setTimeout(resolve, 6000)); // wait for page load

    let result = await sendActionToTab(tab.id, { type: 'SEND_MESSAGE', message });

    // The profile-page click didn't open the compose overlay. The Message
    // link's href is a real navigable URL though, and a navigation is not
    // something page JS can decline the way it can ignore a click — so drive
    // the tab there directly and re-enter the flow at the typing step. Has
    // to happen here rather than in the content script, because navigating
    // destroys the context that would otherwise finish the send.
    if (!result.success && result.navigateTo) {
      logEvent(`Click didn't open the composer; navigating tab ${tab.id} directly to the compose URL`, 'info');
      await chrome.tabs.update(tab.id, { url: result.navigateTo });
      await waitForTabLoad(tab.id);
      await new Promise((resolve) => setTimeout(resolve, 4000)); // let the messaging app hydrate
      result = await sendActionToTab(tab.id, { type: 'TYPE_AND_SEND', message });
    }

    if (!result.success) {
      logEvent(`LinkedIn send rejected by tab ${tab.id}: ${result.error || 'Send failed'}`, 'error');
      throw new Error(result.error || 'Send failed');
    }
    const response = result;

    logEvent(`LinkedIn send action succeeded; holding tab open for ${TAB_CLOSE_DELAY_MS / 1000}s before cleanup`, 'info');
    await new Promise((resolve) => setTimeout(resolve, TAB_CLOSE_DELAY_MS));
    return response;
  } catch (error) {
    logEvent(`LinkedIn send action failed; holding tab open for ${TAB_CLOSE_DELAY_MS / 1000}s before cleanup (${error.message})`, 'error');
    await new Promise((resolve) => setTimeout(resolve, TAB_CLOSE_DELAY_MS));
    throw error;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
    logEvent(`Closed LinkedIn tab ${tab.id} after send attempt`, 'info');
  }
}

export async function runConnectedSync() {
  if (!(await automationAllowed())) {
    return { synced: 0, failed: 0, skipped: 'automation_off' };
  }
  if (!acquire()) {
    logEvent('Connected sync skipped: another LinkedIn automation is already running', 'info');
    return { synced: 0, failed: 0, skipped: 'busy' };
  }
  let synced = 0;
  let failed = 0;
  let total = 0;

  try {
    const items = await fetchQueue();
    total = items.length;
    logEvent(`Sync: ${total} queued LinkedIn message(s) found.`, total > 0 ? 'info' : 'debug');

    for (const item of items.slice(0, MAX_SYNC_PER_RUN)) {
      try {
        logEvent(`Sending to ${item.lead_name} (${item.campaign_name})...`, 'info');
        logEvent(`Message target URL: ${item.linkedin_url}`, 'debug');
        await sendLinkedinMessage(item.linkedin_url, item.body);
        await reportStatus(item.id, 'sent');
        await logEvent(`Sent to ${item.lead_name}.`, 'success');
        synced++;
      } catch (error) {
        logEvent(`Failed to send to ${item.lead_name}: ${error.message}`, 'error');
        await reportStatus(item.id, 'failed', error.message);
        failed++;
      }
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_SEND_DELAY_MS));
    }
  } finally {
    release();
    logEvent(`Connected sync finished: synced=${synced}, failed=${failed}, total=${total}`, 'info');
  }

  return { synced, failed, total };
}
