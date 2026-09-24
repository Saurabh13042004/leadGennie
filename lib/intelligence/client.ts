import { createHmac } from "node:crypto";
import { z } from "zod";
import { AppError, type ErrorCode } from "@/lib/api/errors";
import {
  capabilitiesSchema,
  runCreatedSchema,
  runViewSchema,
  scoreDataSchema,
  engineErrorSchema,
  type EngineCapabilities,
  type EngineRunRequest,
  type EngineRunView,
  type EngineScoreData,
  type EngineScoreRequest,
} from "./schemas";

/**
 * An engine failure the caller can reason about: `retryable` says whether the SAME request may succeed later
 * (network blip, rate limit, restart) or never will (quota exhausted, bad credentials, invalid request).
 */
export class IntelligenceError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly engineCode?: string,
  ) {
    super(code, message);
    this.name = "IntelligenceError";
  }
}

export type CallMeta = { requestId?: string; agentRunId?: number | null; jobId?: number | null; workspaceId?: number };

/** The seam every caller depends on (DIP): the real HTTP client, `FakeIntelligenceClient`, or the engine's own fake mode. */
export interface IntelligenceClient {
  createRun(req: EngineRunRequest, meta?: CallMeta): Promise<{ runId: string; status: string }>;
  getRun(runId: string, meta?: CallMeta): Promise<EngineRunView>;
  cancelRun(runId: string, meta?: CallMeta): Promise<void>;
  score(req: EngineScoreRequest, meta?: CallMeta): Promise<EngineScoreData>;
  capabilities(meta?: CallMeta): Promise<EngineCapabilities>;
}

const CODE_MAP: Record<string, { code: ErrorCode; retryable: boolean }> = {
  VALIDATION: { code: "VALIDATION_ERROR", retryable: false },
  UNAUTHENTICATED: { code: "NOT_CONFIGURED", retryable: false },
  NOT_FOUND: { code: "NOT_FOUND", retryable: false },
  RATE_LIMITED: { code: "RATE_LIMITED", retryable: true },
  QUOTA_EXCEEDED: { code: "QUOTA_EXCEEDED", retryable: false },
  PROVIDER_ERROR: { code: "PROVIDER_ERROR", retryable: true },
  BUDGET_EXCEEDED: { code: "PROVIDER_ERROR", retryable: false },
  TIMEOUT: { code: "PROVIDER_ERROR", retryable: true },
  UNAVAILABLE: { code: "NOT_CONFIGURED", retryable: true },
  INTERNAL: { code: "PROVIDER_ERROR", retryable: true },
};

export function mapEngineError(err: z.infer<typeof engineErrorSchema>): IntelligenceError {
  const mapped = CODE_MAP[err.code] ?? { code: "PROVIDER_ERROR" as ErrorCode, retryable: true };
  // The engine's own retryable flag is authoritative when it says "never retry"; otherwise our default applies.
  const retryable = err.retryable === false && !["RATE_LIMITED", "TIMEOUT"].includes(err.code) ? false : mapped.retryable && err.retryable;
  const message =
    err.code === "UNAUTHENTICATED"
      ? "The research engine rejected our credentials (check INTELLIGENCE_SERVICE_TOKEN / INTELLIGENCE_SIGNING_SECRET)."
      : err.message;
  return new IntelligenceError(mapped.code, message, mapped.code === "NOT_CONFIGURED" && err.code === "UNAUTHENTICATED" ? false : retryable, err.code);
}

export type HttpClientConfig = { baseUrl: string; token: string; secret: string; timeoutMs?: number };

/** HMAC-SHA256(secret, `timestamp.METHOD.path-with-query.body`) — must match services/intelligence/app/auth.py. */
export function signRequest(secret: string, timestamp: string, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`).digest("hex");
}

export class HttpIntelligenceClient implements IntelligenceClient {
  constructor(private readonly cfg: HttpClientConfig) {}

  private async call<T>(method: "GET" | "POST", path: string, schema: z.ZodType<T>, body?: unknown, meta?: CallMeta): Promise<T> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const ts = (Date.now() / 1000).toString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.token}`,
      "X-LG-Timestamp": ts,
      "X-LG-Signature": signRequest(this.cfg.secret, ts, method, path, raw),
      "Content-Type": "application/json",
    };
    if (meta?.requestId) headers["X-Request-Id"] = meta.requestId;
    if (meta?.agentRunId) headers["X-Agent-Run-Id"] = String(meta.agentRunId);
    if (meta?.jobId) headers["X-Job-Id"] = String(meta.jobId);
    if (meta?.workspaceId) headers["X-Workspace-Id"] = String(meta.workspaceId); // logging only, never authorization

    let res: Response;
    try {
      res = await fetch(new URL(path, this.cfg.baseUrl), {
        method,
        headers,
        body: method === "POST" ? raw : undefined,
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000),
        cache: "no-store",
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new IntelligenceError("PROVIDER_ERROR", timedOut ? "The research engine timed out." : "The research engine is unavailable.", true, "UNREACHABLE");
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new IntelligenceError("PROVIDER_ERROR", `The research engine returned an unreadable response (HTTP ${res.status}).`, res.status >= 500, "BAD_RESPONSE");
    }
    const failure = z.object({ ok: z.literal(false), error: engineErrorSchema }).safeParse(json);
    if (failure.success) throw mapEngineError(failure.data.error);
    if (!res.ok) throw new IntelligenceError("PROVIDER_ERROR", `The research engine answered HTTP ${res.status}.`, res.status >= 500, "HTTP");
    const parsed = z.object({ ok: z.literal(true), data: schema }).safeParse(json);
    if (!parsed.success) {
      // A contract violation is a bug on one side, never something to retry blindly.
      throw new IntelligenceError("PROVIDER_ERROR", "The research engine returned data that does not match the contract.", false, "CONTRACT");
    }
    return parsed.data.data;
  }

  async createRun(req: EngineRunRequest, meta?: CallMeta) {
    const r = await this.call("POST", "/v1/runs", runCreatedSchema, req, meta);
    return { runId: r.run_id, status: r.status };
  }

  async getRun(runId: string, meta?: CallMeta): Promise<EngineRunView> {
    return this.call("GET", `/v1/runs/${encodeURIComponent(runId)}`, runViewSchema, undefined, meta);
  }

  async cancelRun(runId: string, meta?: CallMeta): Promise<void> {
    await this.call("POST", `/v1/runs/${encodeURIComponent(runId)}/cancel`, runViewSchema, {}, meta);
  }

  score(req: EngineScoreRequest, meta?: CallMeta) {
    return this.call("POST", "/v1/score", scoreDataSchema, req, meta);
  }

  capabilities(meta?: CallMeta) {
    return this.call("GET", "/v1/capabilities", capabilitiesSchema, undefined, meta);
  }
}

// ---- wiring -----------------------------------------------------------------------------------------------

let override: IntelligenceClient | null = null;

/** Test seam: install `FakeIntelligenceClient`; pass null to restore the environment-configured client. */
export function setIntelligenceClient(client: IntelligenceClient | null): void {
  override = client;
}

export function isIntelligenceConfigured(): boolean {
  return override !== null || !!(process.env.INTELLIGENCE_URL && process.env.INTELLIGENCE_SERVICE_TOKEN && process.env.INTELLIGENCE_SIGNING_SECRET);
}

export function getIntelligenceClient(): IntelligenceClient {
  if (override) return override;
  const baseUrl = process.env.INTELLIGENCE_URL;
  const token = process.env.INTELLIGENCE_SERVICE_TOKEN;
  const secret = process.env.INTELLIGENCE_SIGNING_SECRET;
  if (!baseUrl || !token || !secret) {
    throw new AppError("NOT_CONFIGURED", "The research engine is not configured. Set INTELLIGENCE_URL, INTELLIGENCE_SERVICE_TOKEN and INTELLIGENCE_SIGNING_SECRET.");
  }
  return new HttpIntelligenceClient({ baseUrl, token, secret });
}
