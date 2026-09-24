import { promises as dns } from "node:dns";
import type { MxResult } from "./email";

/**
 * Optional MX check (WP1.3): "can this domain receive mail at all?". Async,
 * cached, and OFF by default in imports — DNS from a request handler is
 * unpredictable, so callers opt in. The resolver is an interface (DIP) so tests
 * and future providers substitute it.
 */
export interface MxResolver {
  resolve(domain: string): Promise<MxResult>;
}

/**
 * Role-specific seam for a future third-party verifier (mailbox-level checks).
 * V1 ships no implementation beyond the no-op below.
 */
export interface EmailVerifier {
  verify(email: string): Promise<{ status: "valid" | "invalid" | "risky" | "unknown"; provider: string }>;
}
export const noopEmailVerifier: EmailVerifier = {
  verify: async () => ({ status: "unknown", provider: "none" }),
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3000;
// "Definitely no mail server" codes. Anything else (timeout, SERVFAIL) is `unknown`, never `no_mx`.
const NO_MX_CODES = new Set(["ENOTFOUND", "ENODATA"]);

export class DnsMxResolver implements MxResolver {
  private cache = new Map<string, { result: MxResult; expires: number }>();

  constructor(
    private readonly lookup: (domain: string) => Promise<{ exchange: string }[]> = (d) => dns.resolveMx(d),
    private readonly now: () => number = Date.now,
  ) {}

  async resolve(domain: string): Promise<MxResult> {
    const key = domain.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && hit.expires > this.now()) return hit.result;

    let result: MxResult;
    try {
      const records = await Promise.race([
        this.lookup(key),
        new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), LOOKUP_TIMEOUT_MS)),
      ]);
      // RFC 7505 "null MX": a single "." exchange means the domain explicitly accepts no mail.
      const real = records.filter((r) => r.exchange && r.exchange !== ".");
      result = real.length > 0 ? "has_mx" : "no_mx";
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      result = NO_MX_CODES.has(code) ? "no_mx" : "unknown";
    }
    if (result !== "unknown") this.cache.set(key, { result, expires: this.now() + CACHE_TTL_MS });
    return result;
  }
}

/** Resolve many domains with bounded concurrency; returns domain → result. */
export async function resolveDomains(
  resolver: MxResolver,
  domains: string[],
  concurrency = 10,
): Promise<Map<string, MxResult>> {
  const unique = Array.from(new Set(domains.map((d) => d.toLowerCase())));
  const out = new Map<string, MxResult>();
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const d = unique[next++];
      out.set(d, await resolver.resolve(d));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return out;
}

export const defaultMxResolver: MxResolver = new DnsMxResolver();
