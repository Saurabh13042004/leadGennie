import { REQUEST_TIMEOUT_MS } from './config.js';
import { clearSession, getSession } from './storage.js';

/**
 * The one place the extension talks to LeadGennie. Every caller gets the same behaviour:
 *   - the bearer token is attached here, never by callers;
 *   - the server's { ok, error, code } envelope becomes an ApiError with a stable `code` the UI can switch on;
 *   - a 401 means the token was revoked/expired: the session is forgotten and the UI is told to sign in again.
 */
export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = extra.status ?? null;
    this.retryAfter = extra.retryAfter ?? null;
    this.details = extra.details ?? null;
  }
  toJSON() {
    return { code: this.code, message: this.message, status: this.status, retryAfter: this.retryAfter };
  }
}

const STATUS_CODE = { 400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'VALIDATION_ERROR', 429: 'RATE_LIMITED', 503: 'NOT_CONFIGURED' };

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toApiError(res, json) {
  const code = json && json.code ? json.code : STATUS_CODE[res.status] || (res.status >= 500 ? 'SERVER' : 'ERROR');
  const message = (json && json.error) || `LeadGennie returned an error (${res.status}).`;
  const retry = Number(res.headers.get('retry-after'));
  return new ApiError(code, message, { status: res.status, retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null, details: json && json.details });
}

/** fetch with a timeout; turns network failures into a friendly NETWORK error. */
async function timedFetch(url, init, apiBase, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    throw new ApiError('NETWORK', timedOut ? `LeadGennie at ${apiBase} took too long to respond.` : `Can't reach LeadGennie at ${apiBase}. Check your connection or the server address in Settings.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Authenticated call to /api/extension/<path>. Resolves with the parsed envelope (`{ ok: true, ... }`).
 * @param {string} path
 * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, session?: object | null }} [opts]
 * @returns {Promise<any>}
 */
export async function apiFetch(path, { method = 'GET', body, query, session } = {}) {
  const s = session || (await getSession());
  if (!s) throw new ApiError('NOT_CONNECTED', 'Connect LeadGennie to continue.');

  const url = new URL(`${s.apiBase}/api/extension${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));

  const res = await timedFetch(url.toString(), {
    method,
    headers: { Authorization: `Bearer ${s.accessToken}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, s.apiBase);

  const json = await readJson(res);
  if (res.ok && json && json.ok !== false) return json;
  if (res.status === 401) {
    await clearSession('expired');
    throw new ApiError('UNAUTHENTICATED', 'Your LeadGennie connection expired or was disconnected. Connect again.', { status: 401 });
  }
  throw toApiError(res, json);
}

/**
 * Unauthenticated call (only the code→token exchange): same envelope handling, no session required.
 * @param {string} apiBase
 * @param {string} path
 * @param {unknown} body
 * @returns {Promise<any>}
 */
export async function publicFetch(apiBase, path, body) {
  const res = await timedFetch(`${apiBase}/api/extension${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, apiBase);
  const json = await readJson(res);
  if (res.ok && json && json.ok !== false) return json;
  throw toApiError(res, json);
}
