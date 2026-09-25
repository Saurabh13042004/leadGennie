// LinkedIn automation, as a plug-in to the service worker. Everything here is inert unless automationAllowed().
import { logEvent } from '../lib/log.js';
import { automationAllowed } from './gate.js';
import { generatePersonalizedMessage, pickElement } from './personalize.js';
import { runConnectedSync } from './queue-sync.js';
import { runStandaloneMode } from './standalone.js';
import { trustedClick, trustedType } from './trusted-input.js';

const ALARM = 'queueProcessor';

const off = () => {
  throw new Error('LinkedIn automation is turned off for this workspace.');
};

/** Keep the once-a-minute queue poll only while automation is genuinely allowed (no alarm = nothing polls). */
export async function syncAlarm() {
  if (!chrome.alarms) return;
  if (await automationAllowed()) {
    if (!(await chrome.alarms.get(ALARM))) chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  } else {
    await chrome.alarms.clear(ALARM);
  }
}

/**
 * Registers the LinkedIn-automation message types. They come from content/linkedin-automation.js and the options page's
 * automation panel and use the older `{ success, ... }` response shape, so they go on the worker's `legacy` responder map:
 * whatever a responder returns is spread into `{ success: true, ... }`, and a throw becomes `{ success: false, error }`.
 */
export function registerAutomation(handlers, legacy) {
  legacy.SYNC_NOW = async () => runConnectedSync();
  legacy.START_STANDALONE_RUN = async () => {
    await runStandaloneMode();
    return {};
  };
  legacy.PERSONALIZE_SCRAPE = async (m) => ((await automationAllowed()) ? { data: await generatePersonalizedMessage(m.context) } : off());
  legacy.PICK_ELEMENT = async (m) => ((await automationAllowed()) ? { data: await pickElement(m.candidates, m.taskDescription) } : off());
  legacy.TRUSTED_CLICK = async (m, sender) => {
    if (!(await automationAllowed())) off();
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) throw new Error('No tab id available for trusted click');
    return { point: await trustedClick(tabId, m.selector) };
  };
  legacy.TRUSTED_TYPE = async (m, sender) => {
    if (!(await automationAllowed())) off();
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) throw new Error('No tab id available for trusted type');
    await trustedType(tabId, m.text);
    return {};
  };
  legacy.LOG_EVENT = async (m) => {
    await logEvent(m.message, m.level);
    return {};
  };

  if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM) runConnectedSync().catch((e) => logEvent(`Periodic sync failed: ${e.message}`, 'error'));
    });
  }
  syncAlarm().catch(() => {});
  chrome.permissions?.onAdded?.addListener(() => syncAlarm().catch(() => {}));
  chrome.permissions?.onRemoved?.addListener(() => syncAlarm().catch(() => {}));
}
