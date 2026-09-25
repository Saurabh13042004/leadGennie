/**
 * The contract between the UI contexts (popup, options, on-page widget) and the service worker. The UI never holds
 * the access token and never calls LeadGennie itself — it asks the worker, which owns the session. That is also the
 * only way the on-page widget can reach the API at all (a page's CORS rules do not apply to the worker).
 */
export const MSG = {
  STATUS: 'lg/status',
  CONNECT: 'lg/connect',
  DISCONNECT: 'lg/disconnect',
  REFRESH: 'lg/refresh',
  EXTRACT: 'lg/extract',
  CREATE: 'lg/create',
  LOOKUP: 'lg/lookup',
  LIST: 'lg/list',
  GET_LEAD: 'lg/get-lead',
  RESEARCH: 'lg/research',
  SAVE_SETTINGS: 'lg/save-settings',
  LOG: 'lg/log',
  GET_LOGS: 'lg/logs',
  CLEAR_LOGS: 'lg/clear-logs',
};

/** Resolves with the worker's `{ ok: true, data }` / `{ ok: false, error: { code, message } }` — never rejects. */
export function send(type, payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve({ ok: false, error: { code: 'WORKER', message: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'The extension did not respond. Reload the page and try again.' } });
        } else resolve(res);
      });
    } catch (e) {
      // "Extension context invalidated": the extension was reloaded while this page stayed open.
      resolve({ ok: false, error: { code: 'WORKER', message: 'The extension was updated. Reload this page to keep using it.' } });
    }
  });
}
