import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpIntelligenceClient, IntelligenceError, mapEngineError, signRequest } from "@/lib/intelligence/client";

describe("request signing (must match services/intelligence/app/auth.py)", () => {
  // Vectors produced by the engine's own sign() — a mismatch here means every real request would be rejected.
  it("matches the engine's HMAC for a POST with a body", () => {
    expect(signRequest("test-secret", "1790000000.5", "POST", "/v1/runs", '{"a":1}')).toBe("04506ac2589427660f011f49e5019049408f9659e155ae6fcc63938ac1391be7");
  });
  it("binds method, path and query (a captured signature can't be replayed elsewhere)", () => {
    expect(signRequest("test-secret", "1790000000.5", "GET", "/v1/runs/run_1?x=1", "")).toBe("cdf6ffe9f4fbe9a959b6d5813eb3b6f0b81689f9db73668419a0cf2387f2e26a");
    expect(signRequest("test-secret", "1790000000.5", "GET", "/v1/runs/run_2?x=1", "")).not.toBe("cdf6ffe9f4fbe9a959b6d5813eb3b6f0b81689f9db73668419a0cf2387f2e26a");
  });
});

describe("HttpIntelligenceClient", () => {
  const cfg = { baseUrl: "http://engine.test", token: "tok", secret: "test-secret", timeoutMs: 500 };
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => { fetchMock.mockReset(); vi.unstubAllGlobals(); });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("sends a signed request with bearer + correlation headers (never a workspace as authorization)", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: { run_id: "run_1", status: "queued" } }, 202));
    const r = await new HttpIntelligenceClient(cfg).createRun(
      { idempotency_key: "k-12345678", task: "lead_research", input: { company: { name: "Acme" } }, context: { icp: { industries: [], employee_range: null, geographies: [], titles: [], keyword_signals: [], exclusions: { industries: [], domains: [], titles: [] }, min_score_to_qualify: 70 }, positioning: "", offer_keywords: [] } },
      { agentRunId: 7, jobId: 9, workspaceId: 3 },
    );
    expect(r).toEqual({ runId: "run_1", status: "queued" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://engine.test/v1/runs");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer tok");
    expect(h["X-LG-Signature"]).toBe(signRequest("test-secret", h["X-LG-Timestamp"], "POST", "/v1/runs", init.body as string));
    expect(h["X-Agent-Run-Id"]).toBe("7");
    expect(h["X-Job-Id"]).toBe("9");
  });

  it.each([
    ["QUOTA_EXCEEDED", "QUOTA_EXCEEDED", false],
    ["RATE_LIMITED", "RATE_LIMITED", true],
    ["VALIDATION", "VALIDATION_ERROR", false],
    ["UNAUTHENTICATED", "NOT_CONFIGURED", false],
    ["PROVIDER_ERROR", "PROVIDER_ERROR", true],
    ["TIMEOUT", "PROVIDER_ERROR", true],
  ])("maps engine error %s → %s (retryable: %s)", async (engineCode, code, retryable) => {
    const err = mapEngineError({ code: engineCode, message: "boom", retryable: engineCode !== "QUOTA_EXCEEDED" && engineCode !== "VALIDATION" && engineCode !== "UNAUTHENTICATED" });
    expect(err).toBeInstanceOf(IntelligenceError);
    expect({ code: err.code, retryable: err.retryable }).toEqual({ code, retryable });
  });

  it("turns engine error envelopes into IntelligenceError", async () => {
    fetchMock.mockResolvedValue(json({ ok: false, error: { code: "QUOTA_EXCEEDED", message: "LLM quota exceeded", retryable: false } }, 429));
    await expect(new HttpIntelligenceClient(cfg).capabilities()).rejects.toMatchObject({ code: "QUOTA_EXCEEDED", retryable: false });
  });

  it("an unreachable engine is a RETRYABLE error with a plain message", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(new HttpIntelligenceClient(cfg).capabilities()).rejects.toMatchObject({ code: "PROVIDER_ERROR", retryable: true, message: expect.stringMatching(/unavailable/) });
  });

  it("a timeout is retryable", async () => {
    const e = new Error("timed out"); e.name = "TimeoutError";
    fetchMock.mockRejectedValue(e);
    await expect(new HttpIntelligenceClient(cfg).capabilities()).rejects.toMatchObject({ retryable: true, message: expect.stringMatching(/timed out/) });
  });

  it("a contract violation is NOT retried blindly", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: { unexpected: true } }));
    await expect(new HttpIntelligenceClient(cfg).createRun({} as never)).rejects.toMatchObject({ engineCode: "CONTRACT", retryable: false });
  });

  it("garbage / non-JSON responses are handled", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(new HttpIntelligenceClient(cfg).capabilities()).rejects.toMatchObject({ engineCode: "BAD_RESPONSE", retryable: true });
  });
});
