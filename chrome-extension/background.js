// LeadGennie extension — service worker.
//
// Owns the session and every network call. The popup, options page and on-page widget only send messages here
// (see lib/messages.js), so the access token never leaves this context and every error is handled in one place.
import { ApiError, apiFetch } from './lib/api.js';
import { connect, disconnect, refreshSession } from './lib/auth.js';
import { logEvent, getLogs, clearLogs } from './lib/log.js';
import { MSG } from './lib/messages.js';
import { getSession, getSettings, migrateLegacyConnection, setSettings, takeSignedOutReason } from './lib/storage.js';
import { registerAutomation } from './automation/index.js';

/**
 * Responders for the retained LinkedIn-automation messages, which speak the older `{ success, ... }` shape and carry their
 * fields at the top level. Kept as-is so that code can stay untouched. Populated by registerAutomation().
 */
const legacy = {};

/** What the UI may know about the session — never the token. */
function publicSession(session) {
  if (!session) return null;
  const { accessToken, ...rest } = session; // eslint-disable-line no-unused-vars
  return rest;
}

const enc = encodeURIComponent;

/**
 * Message handlers, keyed by type (Open/Closed: a new capability is one entry here, not another `if`).
 * Each returns plain data; the router wraps success/failure into the { ok, data | error } envelope.
 */
const handlers = {
  async [MSG.STATUS]() {
    const session = await getSession();
    return { connected: !!session, session: publicSession(session), settings: await getSettings(), reason: session ? null : await takeSignedOutReason() };
  },

  async [MSG.CONNECT]({ apiBase }) {
    const session = await connect({ apiBase });
    await setSettings({ apiBase: session.apiBase });
    return publicSession(session);
  },

  async [MSG.DISCONNECT]() {
    await disconnect();
    return { connected: false };
  },

  async [MSG.REFRESH]() {
    return publicSession(await refreshSession());
  },

  async [MSG.EXTRACT]({ facts }) {
    const r = await apiFetch('/capture/extract', { method: 'POST', body: facts });
    return { candidate: r.candidate, existing: r.existing };
  },

  async [MSG.CREATE]({ lead }) {
    const r = await apiFetch('/leads', { method: 'POST', body: { lead } });
    await logEvent(r.created ? `Added ${r.lead.fullName} to LeadGennie` : `${r.lead.fullName} is already in LeadGennie`, r.created ? 'success' : 'info');
    return { created: r.created, lead: r.lead };
  },

  async [MSG.LOOKUP](q) {
    const r = await apiFetch('/leads/lookup', { query: { linkedin_url: q.linkedinUrl, email: q.email, name: q.name, company: q.company } });
    return { found: r.found, lead: r.lead };
  },

  async [MSG.LIST]({ q, limit } = {}) {
    const r = await apiFetch('/leads', { query: { q, limit: limit || 15 } });
    return { leads: r.leads, total: r.total };
  },

  async [MSG.GET_LEAD]({ id }) {
    const r = await apiFetch(`/leads/${enc(id)}`);
    return { lead: r.lead };
  },

  async [MSG.RESEARCH]({ id }) {
    const r = await apiFetch(`/leads/${enc(id)}/research`, { method: 'POST' });
    await logEvent(r.queued ? `Started research for lead ${id}` : `Research for lead ${id} not started (${r.skipped || 'skipped'})`, r.queued ? 'success' : 'info');
    return { queued: r.queued, skipped: r.skipped };
  },

  async [MSG.SAVE_SETTINGS]({ apiBase }) {
    return setSettings({ apiBase });
  },

  async [MSG.LOG]({ message, level }) {
    await logEvent(message, level);
    return {};
  },
  async [MSG.GET_LOGS]() {
    return { logs: await getLogs() };
  },
  async [MSG.CLEAR_LOGS]() {
    await clearLogs();
    return {};
  },
};

// LinkedIn automation (D-05) registers its own handlers, and only does anything while the server has it enabled.
registerAutomation(handlers, legacy);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  const responder = legacy[message.type];
  if (responder) {
    Promise.resolve(responder(message, sender))
      .then((extra) => sendResponse({ success: true, ...(extra || {}) }))
      .catch((e) => sendResponse({ success: false, error: (e && e.message) || 'Failed' }));
    return true;
  }

  const handler = handlers[message.type];
  if (!handler) return false; // not ours
  handler(message.payload || {}, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => {
      const error = e instanceof ApiError ? e.toJSON() : { code: 'ERROR', message: (e && e.message) || 'Something went wrong.' };
      if (!(e instanceof ApiError)) console.error('[LeadGennie]', e); // eslint-disable-line no-console
      sendResponse({ ok: false, error });
    });
  return true; // async response
});

chrome.runtime.onInstalled.addListener(async () => {
  await migrateLegacyConnection();
});
chrome.runtime.onStartup.addListener(async () => {
  await migrateLegacyConnection();
});
