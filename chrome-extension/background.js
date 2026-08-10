import { generatePersonalizedMessage } from './services/gemini.js';
import { fetchNextPendingLead, updateLeadStatus } from './services/gsheets.js';
import { addLeadToCrm, pickElement } from './services/leadgennie-api.js';

// Safety caps: never let one automated pass hammer LinkedIn. Matches the
// pacing already accepted for Standalone Mode below (~10s between actions).
const MAX_SYNC_PER_RUN = 20;
const BETWEEN_SEND_DELAY_MS = 10000;
const TAB_CLOSE_DELAY_MS = 15000;
const MAX_LOG_ENTRIES = 200;

// Shared across Connected sync and Standalone Mode so they can never run
// two LinkedIn automations in the same browser at once.
let isExecuting = false;

// --- Activity log ---
// Persisted (survives popup/service-worker restarts) so "what did the
// extension actually do" has an answer beyond an ephemeral popup log box
// that resets every time it's closed. Every context (content.js, popup.js,
// background.js itself) routes through here via LOG_EVENT so there's one
// buffer, not three.
async function logEvent(message, level = 'info') {
  console.log(`[LeadGennie:${level}]`, message);
  const { activityLog = [] } = await chrome.storage.local.get(['activityLog']);
  activityLog.push({ ts: Date.now(), level, message });
  if (activityLog.length > MAX_LOG_ENTRIES) activityLog.splice(0, activityLog.length - MAX_LOG_ENTRIES);
  await chrome.storage.local.set({ activityLog });
}

// --- Message Routing ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_STANDALONE_RUN') {
    runStandaloneMode()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'SYNC_NOW') {
    runConnectedSync()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'GET_STATUS') {
    getConnection()
      .then(connection => sendResponse({ connected: Boolean(connection), connection }))
      .catch(() => sendResponse({ connected: false }));
    return true;
  }

  if (request.type === 'PERSONALIZE_SCRAPE') {
    getConnection()
      .then((connection) => generatePersonalizedMessage(connection, request.context))
      .then(data => {
        logEvent(`Generated message for ${request.context?.profileUrl || 'profile'}`, 'success');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logEvent(`Message generation failed: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'ADD_LEAD') {
    // request carries raw scraped pageText + linkedin_url — the backend now
    // does the AI extraction (name/title/company) itself, see
    // app/api/extension/leads/route.ts.
    getConnection()
      .then((connection) => addLeadToCrm(connection, { pageText: request.pageText, linkedin_url: request.linkedin_url }))
      .then(data => {
        logEvent(`Added lead to CRM: ${data?.full_name || 'unknown'}`, 'success');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logEvent(`Add lead failed: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'PICK_ELEMENT') {
    getConnection()
      .then((connection) => pickElement(connection, request.candidates, request.taskDescription))
      .then(data => {
        logEvent(`AI element pick: index=${data.index} (${data.reason || 'no reason given'})`, data.index === null ? 'error' : 'info');
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logEvent(`AI element pick failed: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'TRUSTED_CLICK') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab id available for trusted click' });
      return true;
    }
    trustedClick(tabId, request.selector)
      .then((point) => {
        logEvent(`Trusted click dispatched at (${point.x}, ${point.y}) on tab ${tabId} [post-attach, hitMatches=${point.hitMatches}]`, 'debug');
        sendResponse({ success: true, point });
      })
      .catch((error) => {
        logEvent(`Trusted click failed: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'TRUSTED_TYPE') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab id available for trusted type' });
      return true;
    }
    trustedType(tabId, request.text)
      .then(() => {
        logEvent(`Trusted type dispatched (${request.text.length} chars) on tab ${tabId}`, 'debug');
        sendResponse({ success: true });
      })
      .catch((error) => {
        logEvent(`Trusted type failed: ${error.message}`, 'error');
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'LOG_EVENT') {
    logEvent(request.message, request.level);
    return;
  }

  if (request.type === 'GET_LOGS') {
    chrome.storage.local.get(['activityLog']).then(({ activityLog = [] }) => sendResponse({ logs: activityLog }));
    return true;
  }

  if (request.type === 'CLEAR_LOGS') {
    chrome.storage.local.set({ activityLog: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// --- Periodic sync against the real LeadGennie queue ---
chrome.alarms.create("queueProcessor", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "queueProcessor") {
    runConnectedSync().catch((e) => logEvent(`Periodic sync failed: ${e.message}`, 'error'));
  }
});

// --- Connected Mode: authenticated sync with the LeadGennie backend ---
// Messages arrive here already AI-personalized (written server-side when the
// campaign was scheduled) — this file's only job is to execute the LinkedIn
// action in a real browser tab and report the result back, keeping
// campaign_sends in the database (and therefore the dashboard) in sync.

async function getConnection() {
  const { connection } = await chrome.storage.sync.get(['connection']);
  return connection && connection.apiToken ? connection : null;
}

// --- Trusted click (Chrome DevTools Protocol) ---
// A script-dispatched element.click() sets event.isTrusted = false — a
// browser-level guarantee page JS cannot fake. Confirmed live: LinkedIn's
// "open the message compose overlay" action didn't fire for a script click
// even on the correct, AI-verified element (URL never changed, no compose
// box ever mounted) — the same symptom for both a wrong link and the
// confirmed-right one, which is what pointed at the click itself rather
// than element-selection. chrome.debugger lets an extension attach to a tab
// via CDP and dispatch a real mouse event at the OS/browser input level,
// which LinkedIn's own code cannot distinguish from a genuine user click.
// Attaching shows Chrome's own "is being debugged" banner on the tab —
// visible by design, not something an extension can hide.
async function trustedClick(tabId, selector) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    // Attaching resizes the tab's viewport (the infobar takes real space),
    // reflowing the page — any coordinates measured before this point are
    // already stale. Give the reflow a moment to settle, then re-locate and
    // re-measure the target *inside the CDP session* so the click uses
    // current, post-attach coordinates. Also hit-tests at that point so a
    // failure here is diagnosable without another round trip.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const { result } = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false };
        const r = el.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(x, y);
        const hitMatches = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        return { found: true, x, y, hitTag: hit && hit.tagName, hitMatches };
      })()`,
      returnByValue: true,
    });
    const point = result && result.value;
    if (!point || !point.found) {
      throw new Error(`Trusted click target not found after debugger attach (selector: ${selector})`);
    }
    const { x, y } = point;

    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y,
    });
    await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 120));
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 80));
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
    });
    return point;
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

// Companion to trustedClick — same trust gap, one layer over. Manual DOM
// text-node insertion + synthetic beforeinput/input events left characters
// genuinely present in the DOM, but LinkedIn's editor never recognized it as
// real input (confirmed live: placeholder stayed active, Send never
// enabled). CDP's Input.insertText inserts into whatever element the page
// currently has focused, generating real trusted input events the same way
// a real IME/keyboard would — the target must already be focused via a
// regular DOM .focus()/click before this is called.
async function trustedType(tabId, text) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the infobar reflow settle
    for (const ch of text) {
      await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text: ch });
      await new Promise((resolve) => setTimeout(resolve, 35 + Math.random() * 90));
    }
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

async function fetchQueue(connection) {
  const res = await fetch(`${connection.apiBase}/api/extension/queue`, {
    headers: { Authorization: `Bearer ${connection.apiToken}` },
  });
  if (res.status === 401) throw new Error("API token was rejected — reconnect in Settings.");
  if (!res.ok) throw new Error(`Failed to fetch queue (${res.status})`);
  const data = await res.json();
  return data.items || [];
}

async function reportStatus(connection, id, status, error) {
  await fetch(`${connection.apiBase}/api/extension/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.apiToken}` },
    body: JSON.stringify({ id, status, error }),
  });
}

// Resolves with the content script's raw reply instead of rejecting on a
// failed send, so the caller can inspect `navigateTo` and decide whether the
// failure is recoverable.
function sendActionToTab(tabId, action) {
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

async function runConnectedSync() {
  const connection = await getConnection();
  if (!connection) {
    logEvent('Connected sync skipped: no API connection configured', 'info');
    return { synced: 0, failed: 0, skipped: 'not_connected' };
  }
  if (isExecuting) {
    logEvent('Connected sync skipped: another LinkedIn automation is already running', 'info');
    return { synced: 0, failed: 0, skipped: 'busy' };
  }

  isExecuting = true;
  let synced = 0;
  let failed = 0;
  let total = 0;

  try {
    const items = await fetchQueue(connection);
    total = items.length;
    logEvent(`Sync: ${total} queued LinkedIn message(s) found.`, total > 0 ? 'info' : 'debug');

    for (const item of items.slice(0, MAX_SYNC_PER_RUN)) {
      try {
        logEvent(`Sending to ${item.lead_name} (${item.campaign_name})...`, 'info');
        logEvent(`Message target URL: ${item.linkedin_url}`, 'debug');
        await sendLinkedinMessage(item.linkedin_url, item.body);
        await reportStatus(connection, item.id, 'sent');
        await logEvent(`Sent to ${item.lead_name}.`, 'success');
        synced++;
      } catch (error) {
        logEvent(`Failed to send to ${item.lead_name}: ${error.message}`, 'error');
        await reportStatus(connection, item.id, 'failed', error.message);
        failed++;
      }
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_SEND_DELAY_MS));
    }
  } finally {
    isExecuting = false;
    logEvent(`Connected sync finished: synced=${synced}, failed=${failed}, total=${total}`, 'info');
  }

  return { synced, failed, total };
}

// --- Standalone Mode (no LeadGennie account — local Google Sheets + Gemini) ---
async function runStandaloneMode() {
  if (isExecuting) throw new Error("Already executing a task.");
  isExecuting = true;

  try {
    const settings = await chrome.storage.sync.get([
      'sheetId', 'sheetRange', 'maxLeads', 'sdrContext', 'customPrompt',
    ]);
    const connection = await getConnection();
    if (!connection) {
      throw new Error("Not connected to LeadGennie. Add your API token in Settings — Standalone Mode still uses your workspace's AI, it just skips creating a formal Campaign.");
    }
    if (!settings.sheetId) {
      throw new Error("Missing Sheet ID. Please configure options.");
    }
    const sheetRange = settings.sheetRange || 'Sheet1!A:Z';
    const sheetName = sheetRange.split('!')[0] || 'Sheet1';
    const maxLeads = settings.maxLeads || 20;
    let sentCount = 0;

    while (isExecuting) {
      if (sentCount >= maxLeads) {
        await logEvent(`Reached safety limit: sent ${maxLeads} requests. Stopping standalone mode.`);
        break;
      }

      await logEvent("Fetching next lead from Google Sheets...");
      const lead = await fetchNextPendingLead(settings.sheetId, sheetRange);

      if (!lead) {
        await logEvent("No more pending leads found in the sheet. Stopping.");
        break;
      }

      await logEvent(`Processing lead: ${lead.url}`);

      // 1. Open Tab
      const tab = await chrome.tabs.create({ url: lead.url, active: true });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 6000));

      // 2. Scrape and Check Status
      const scrapeRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK_STATUS_AND_SCRAPE' }, resolve);
      });

      if (!scrapeRes || !scrapeRes.success) {
        await logEvent("Scrape failed. Updating sheet to Failed to Scrape.", 'error');
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Failed to Scrape", "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      if (scrapeRes.status === "Already Connected" || scrapeRes.status === "Pending" || scrapeRes.status === "Profile not found") {
        await logEvent(`Lead is ${scrapeRes.status}`);
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, scrapeRes.status, "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      // 3. Generate Message via LeadGennie's backend (which calls Gemini)
      await logEvent("Generating message via LeadGennie...");
      let geminiRes;
      try {
        geminiRes = await generatePersonalizedMessage(connection, scrapeRes.context, settings.sdrContext, settings.customPrompt);
      } catch (e) {
        await logEvent(`Personalization failed: ${e.message}`, 'error');
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Gemini Error", "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      // 4. Execute Connection
      await logEvent("Executing connection request...");
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXECUTE_ACTION',
          action: { type: 'SEND_CONNECTION', note: geminiRes.message }
        }, (res) => {
          if (chrome.runtime.lastError || (res && !res.success)) reject(chrome.runtime.lastError || res.error);
          else resolve(res);
        });
      });

      // 5. Update Sheet
      await logEvent("Updating sheet with insights...");
      await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Request Sent", geminiRes.message, geminiRes.insights);
      chrome.tabs.remove(tab.id);

      sentCount++;

      await logEvent(`Waiting 10 seconds before processing next lead. (${sentCount}/${maxLeads} requests sent today)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    await logEvent("Standalone sequence complete.", 'success');

  } catch (error) {
    await logEvent(`Standalone Mode Error: ${error.message}`, 'error');
    throw error;
  } finally {
    isExecuting = false;
  }
}
