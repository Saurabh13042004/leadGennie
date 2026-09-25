// Constants shared by every extension context (service worker, popup, options, on-page widget).

/** Where a fresh install looks for LeadGennie. Change it in the extension's settings (Options → Server). */
export const DEFAULT_APP_URL = 'http://localhost:3000';

/** A request that takes longer than this is treated as "can't reach the server". */
export const REQUEST_TIMEOUT_MS = 20000;

/** How much page text the extension reads. The server caps it again before any model sees it. */
export const PAGE_TEXT_LIMIT = 12000;

/** How often the popup / widget re-checks a research run, and for how long. */
export const RESEARCH_POLL_MS = 5000;
export const RESEARCH_POLL_MAX_MS = 3 * 60 * 1000;

/** The activity log keeps capture events only, and never more than this many. */
export const MAX_LOG_ENTRIES = 100;

export const STORAGE_KEYS = {
  session: 'session',
  settings: 'settings',
  log: 'activityLog',
  legacyConnection: 'connection', // pre-Phase-7 { apiBase, apiToken } in chrome.storage.sync
};
