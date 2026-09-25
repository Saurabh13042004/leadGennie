import { MAX_LOG_ENTRIES, STORAGE_KEYS } from './config.js';

/**
 * Activity log: what the extension did on your behalf (captures, connects, errors). Persisted so it survives the
 * popup closing and the service worker restarting. Capture events only — page contents are never written here.
 */
export async function logEvent(message, level = 'info') {
  const { [STORAGE_KEYS.log]: log = [] } = await chrome.storage.local.get(STORAGE_KEYS.log);
  log.push({ ts: Date.now(), level, message: String(message).slice(0, 300) });
  if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
  await chrome.storage.local.set({ [STORAGE_KEYS.log]: log });
}

export async function getLogs() {
  const { [STORAGE_KEYS.log]: log = [] } = await chrome.storage.local.get(STORAGE_KEYS.log);
  return log;
}

export async function clearLogs() {
  await chrome.storage.local.set({ [STORAGE_KEYS.log]: [] });
}
