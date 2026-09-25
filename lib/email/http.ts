import { MailProviderError } from "./provider";
import type { AccessTokenSource } from "./mailbox-provider";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Connection errors that prove the request never reached the provider's servers (so nothing can have been sent). */
const NEVER_REACHED = new Set(["ENOTFOUND", "ECONNREFUSED", "EAI_AGAIN", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"]);

function errorCode(e: unknown): string | undefined {
  const cause = (e as { cause?: unknown } | null)?.cause as { code?: string } | undefined;
  return cause?.code ?? (e as { code?: string } | null)?.code;
}

/**
 * Turns a thrown fetch failure into a `MailProviderError`. For a request that CHANGES state (sending) a lost connection is
 * ambiguous — the provider may have accepted it — so it becomes `unknown_outcome` unless the error proves the request never
 * left. For a read there is nothing to duplicate, so any failure is simply retryable.
 */
export function classifyFetchFailure(e: unknown, mutating: boolean): MailProviderError {
  const code = errorCode(e);
  const message = e instanceof Error ? e.message : "Network error";
  if (!mutating || (code && NEVER_REACHED.has(code))) return new MailProviderError(message, "retryable", "network_error");
  return new MailProviderError(message, "unknown_outcome", "network_error");
}

/**
 * One authorised request. A 401 means the access token was rejected: refresh once and repeat. If it is rejected again the
 * grant is bad — the caller sees the 401 response and classifies it as `auth`. Never logs or echoes the token.
 */
export async function authorizedFetch(
  source: AccessTokenSource,
  fetchImpl: FetchLike,
  url: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
  opts: { mutating: boolean },
): Promise<Response> {
  const attempt = async (token: string) => {
    try {
      return await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    } catch (e) {
      throw classifyFetchFailure(e, opts.mutating);
    }
  };
  const res = await attempt(await source.getAccessToken());
  if (res.status !== 401) return res;
  return attempt(await source.refresh());
}

/** A provider's error body is JSON most of the time; never let a parse failure hide the status code. */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export function retryAfterSeconds(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = Number(h);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.ceil(n), 3600);
  const at = Date.parse(h);
  return Number.isNaN(at) ? undefined : Math.min(Math.max(1, Math.ceil((at - Date.now()) / 1000)), 3600);
}
