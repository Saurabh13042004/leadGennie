import { publicFetch, apiFetch, ApiError } from './api.js';
import { clearSession, getSession, setSession } from './storage.js';
import { logEvent } from './log.js';

/**
 * Connect / disconnect. The extension never sees a password and the person never copies a token:
 *
 *   1. we open LeadGennie's own consent page in a browser window (chrome.identity.launchWebAuthFlow);
 *   2. they sign in there if needed and approve;
 *   3. LeadGennie redirects back with a one-time code;
 *   4. we exchange it (PKCE: only we hold the verifier) for a token that belongs to THIS browser and person,
 *      and can be revoked from Settings → Browser extension.
 */

const B64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function randomUrlSafe(byteLength = 32) {
  return B64(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Base64Url(text) {
  return B64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

/** "http://localhost:3000/" → "http://localhost:3000". Only https (or localhost over http) is accepted. */
export function normalizeApiBase(input) {
  let url;
  try {
    url = new URL(String(input || '').trim());
  } catch {
    throw new ApiError('BAD_ADDRESS', 'Enter the address of your LeadGennie, e.g. https://app.leadgennie.com');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    throw new ApiError('BAD_ADDRESS', 'LeadGennie must be reached over https (http is only allowed for localhost).');
  }
  return url.origin;
}

export function buildAuthorizeUrl({ apiBase, redirectUri, state, challenge, device }) {
  const u = new URL(`${apiBase}/extension/connect`);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  if (device) u.searchParams.set('device', device);
  return u.toString();
}

/** Reads the redirect back from LeadGennie. Throws a friendly ApiError for denial, tampering, or a missing code. */
export function parseAuthResponse(responseUrl, expectedState) {
  let url;
  try {
    url = new URL(responseUrl);
  } catch {
    throw new ApiError('AUTH_FAILED', 'The connection window closed before finishing.');
  }
  const error = url.searchParams.get('error');
  if (error === 'access_denied') throw new ApiError('ACCESS_DENIED', 'You cancelled the connection.');
  if (error) throw new ApiError('AUTH_FAILED', `LeadGennie refused the connection (${error}).`);
  if (url.searchParams.get('state') !== expectedState) throw new ApiError('AUTH_FAILED', 'The connection response did not match the request. Try again.');
  const code = url.searchParams.get('code');
  if (!code) throw new ApiError('AUTH_FAILED', 'LeadGennie did not return an authorization code.');
  return code;
}

/** "Chrome on macOS" — a label the person will recognise in Settings → Browser extension. */
export function describeDevice(nav = globalThis.navigator) {
  const ua = (nav && nav.userAgent) || '';
  const platform = (nav && nav.userAgentData && nav.userAgentData.platform) || '';
  const os = /Mac/i.test(platform || ua) ? 'macOS' : /Win/i.test(platform || ua) ? 'Windows' : /Linux|CrOS/i.test(platform || ua) ? 'Linux' : 'a computer';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Brave/.test(ua) ? 'Brave' : 'Chrome';
  return `${browser} on ${os}`;
}

/** Runs the whole flow and stores the session. `interactive` is false only in automated tests. */
export async function connect({ apiBase, interactive = true }) {
  const base = normalizeApiBase(apiBase);
  const verifier = randomUrlSafe(32);
  const state = randomUrlSafe(16);
  const redirectUri = chrome.identity.getRedirectURL('connect');
  const authorizeUrl = buildAuthorizeUrl({ apiBase: base, redirectUri, state, challenge: await sha256Base64Url(verifier), device: describeDevice() });

  let responseUrl;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authorizeUrl, interactive });
  } catch (e) {
    throw new ApiError('AUTH_FAILED', /did not approve|cancel|closed/i.test(String(e && e.message)) ? 'You cancelled the connection.' : `Couldn't open the sign-in window: ${(e && e.message) || e}`);
  }
  const code = parseAuthResponse(responseUrl, state);

  const r = await publicFetch(base, '/auth/token', { code, code_verifier: verifier, redirect_uri: redirectUri });
  const session = {
    apiBase: base,
    accessToken: r.access_token,
    kind: 'session',
    expiresAt: r.expires_at,
    user: r.user,
    workspace: r.workspace,
    scopes: r.scopes,
    features: r.features,
    deviceLabel: describeDevice(),
  };
  await setSession(session);
  await logEvent(`Connected to ${r.workspace.name} as ${r.user.email}`, 'success');
  return session;
}

/** Best-effort server-side revoke, then forget the token locally either way. */
export async function disconnect() {
  const session = await getSession();
  if (session && session.kind === 'session') {
    try {
      await apiFetch('/auth/revoke', { method: 'POST', session });
    } catch {
      /* already revoked, or offline: forgetting the token locally is what matters */
    }
  }
  await clearSession();
  await logEvent('Disconnected', 'info');
}

/** Re-reads who we are and what we may do (roles and server features can change while a session lives). */
export async function refreshSession() {
  const session = await getSession();
  if (!session) return null;
  const me = await apiFetch('/me', { session });
  const next = {
    ...session,
    scopes: me.scopes,
    features: me.features,
    ...(me.user ? { user: { ...(session.user || {}), ...me.user } } : {}),
    ...(me.workspace && me.workspace.name ? { workspace: me.workspace } : {}),
  };
  await setSession(next);
  return next;
}
