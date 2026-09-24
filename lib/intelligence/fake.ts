import { IntelligenceError, type CallMeta, type IntelligenceClient } from "./client";
import type { EngineCapabilities, EngineRunRequest, EngineRunView, EngineScoreData, EngineScoreRequest } from "./schemas";

type FakeRun = { req: EngineRunRequest; polls: number };

/**
 * In-memory stand-in for the Python engine, for tests and local development of the Next side (the engine's own
 * `ENGINE_FAKE_MODE` serves the same purpose over HTTP). It mimics the parts of the contract callers depend on:
 * idempotent runs, a queued → running → succeeded lifecycle over successive polls, and injectable faults
 * (engine down, quota, restart that forgets runs, a run that fails, a run that never finishes).
 */
export class FakeIntelligenceClient implements IntelligenceClient {
  /** Every createRun call, including replays of the same idempotency key. */
  readonly createCalls: EngineRunRequest[] = [];
  readonly getCalls: string[] = [];
  readonly cancelCalls: string[] = [];
  readonly scoreCalls: EngineScoreRequest[] = [];

  /** Polls before a run reports `succeeded` (0 = finished on the first poll). */
  pollsBeforeDone = 1;
  /** Supplies the result JSON for a request (tests use the engine's golden fixtures). */
  resultFor: (req: EngineRunRequest) => unknown = () => {
    throw new Error("FakeIntelligenceClient.resultFor is not configured");
  };
  scoreImpl: (req: EngineScoreRequest) => EngineScoreData = () => ({
    scoring_version: "1",
    icp: { score: 50, confidence: 0.5, breakdown: [] },
    intent: { score: 0, breakdown: [] },
    qualified: false,
    why_fit: [],
  });

  faults: {
    createError?: IntelligenceError;
    getError?: IntelligenceError;
    scoreError?: IntelligenceError;
    /** The run ends `failed` with this engine error. */
    runFails?: { code: string; message: string; retryable: boolean };
    /** The run never leaves `running`. */
    neverFinishes?: boolean;
  } = {};

  private runs = new Map<string, FakeRun>();
  private byKey = new Map<string, string>();
  private seq = 0;

  /** Simulate an engine restart that lost its in-memory runs (polling an old id → NOT_FOUND). */
  forgetRuns(): void {
    this.runs.clear();
    this.byKey.clear();
  }

  async createRun(req: EngineRunRequest): Promise<{ runId: string; status: string }> {
    this.createCalls.push(req);
    if (this.faults.createError) throw this.faults.createError;
    const existing = this.byKey.get(req.idempotency_key);
    if (existing) return { runId: existing, status: "queued" };
    const id = `run_fake_${++this.seq}`;
    this.runs.set(id, { req, polls: 0 });
    this.byKey.set(req.idempotency_key, id);
    return { runId: id, status: "queued" };
  }

  async getRun(runId: string, _meta?: CallMeta): Promise<EngineRunView> {
    this.getCalls.push(runId);
    if (this.faults.getError) throw this.faults.getError;
    const run = this.runs.get(runId);
    if (!run) throw new IntelligenceError("NOT_FOUND", "Run not found", false, "NOT_FOUND");
    run.polls += 1;
    const progress = { stage: "collecting", pct: Math.min(90, run.polls * 20) };
    if (this.faults.neverFinishes || run.polls <= this.pollsBeforeDone) {
      return { run_id: runId, status: run.polls === 1 ? "queued" : "running", progress, trace: [], usage: [] };
    }
    if (this.faults.runFails) {
      return { run_id: runId, status: "failed", progress, error: { ...this.faults.runFails }, trace: [], usage: [] };
    }
    return {
      run_id: runId,
      status: "succeeded",
      progress: { stage: "done", pct: 100 },
      result: this.resultFor(run.req),
      trace: [
        { seq: 1, stage: "collecting", tool: "website", started_at: "2026-09-24T10:00:00Z", duration_ms: 1200, status: "ok", input_summary: run.req.input.company.domain ?? "", output_summary: "5 pages", tokens_in: 0, tokens_out: 0 },
        { seq: 2, stage: "extracting", tool: "extract", started_at: "2026-09-24T10:00:02Z", duration_ms: 3400, status: "ok", input_summary: "5 documents", output_summary: "facts=5", tokens_in: 900, tokens_out: 200 },
      ],
      usage: [
        { kind: "llm", provider: "openai", model: "gpt-4o-mini", units: 1, tokens_in: 900, tokens_out: 200, cost_estimate: 0.0043 },
        { kind: "fetch", provider: "http", model: null, units: 5, tokens_in: 0, tokens_out: 0, cost_estimate: 0 },
      ],
    };
  }

  async cancelRun(runId: string): Promise<void> {
    this.cancelCalls.push(runId);
  }

  async score(req: EngineScoreRequest): Promise<EngineScoreData> {
    this.scoreCalls.push(req);
    if (this.faults.scoreError) throw this.faults.scoreError;
    return this.scoreImpl(req);
  }

  async capabilities(): Promise<EngineCapabilities> {
    return { contract_version: "1.0", fake_mode: true, tasks: ["company_research", "lead_research", "find_signals"], connectors: [{ name: "fake", available: true }], task_costs: [] };
  }
}
