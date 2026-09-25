import { DEFAULT_APP_URL, STORAGE_KEYS } from './config.js';

/**
 * Everything the extension remembers lives in chrome.storage.LOCAL — deliberately not `sync`: a token in sync
 * storage would be copied to every browser signed into the same Google account. The session is per browser.
 *
 *   session  { apiBase, accessToken, kind: 'session'|'legacy', expiresAt, user, workspace, scopes, features, deviceLabel }
 *   settings { apiBase }
 */
const area = () => chrome.storage.local;

export async function getSession() {
  const { [STORAGE_KEYS.session]: session } = await area().get(STORAGE_KEYS.session);
  return session && session.accessToken ? session : null;
}

export async function setSession(session) {
  await area().set({ [STORAGE_KEYS.session]: session });
}

/** Signing out (or a 401) forgets the token but remembers WHY, so the popup can explain rather than just go blank. */
export async function clearSession(reason) {
  await area().remove(STORAGE_KEYS.session);
  if (reason) await area().set({ signedOutReason: reason });
}

export async function takeSignedOutReason() {
  const { signedOutReason } = await area().get('signedOutReason');
  if (signedOutReason) await area().remove('signedOutReason');
  return signedOutReason || null;
}

export async function getSettings() {
  const { [STORAGE_KEYS.settings]: settings } = await area().get(STORAGE_KEYS.settings);
  return { apiBase: DEFAULT_APP_URL, ...(settings || {}) };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await area().set({ [STORAGE_KEYS.settings]: next });
  return next;
}

/**
 * Installs made before the connect flow stored `{ apiBase, apiToken }` in chrome.storage.sync. Move that token to
 * local storage (and off the synced copy) and keep it working as a "legacy" session until the person reconnects.
 */
export async function migrateLegacyConnection() {
  if (!chrome.storage.sync) return false;
  const { [STORAGE_KEYS.legacyConnection]: legacy } = await chrome.storage.sync.get(STORAGE_KEYS.legacyConnection);
  if (!legacy || !legacy.apiToken) return false;
  if (!(await getSession())) {
    await setSession({
      apiBase: legacy.apiBase || DEFAULT_APP_URL,
      accessToken: legacy.apiToken,
      kind: 'legacy',
      expiresAt: null,
      user: null,
      workspace: null,
      scopes: ['leads:read', 'leads:create'],
      features: { linkedinAutomation: false, research: false },
      deviceLabel: null,
    });
  }
  await chrome.storage.sync.remove(STORAGE_KEYS.legacyConnection);
  return true;
}
