import type { Logger } from "@/lib/log";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead" | "canceled";

export type JobRow = {
  id: number;
  workspaceId: number;
  userId: number | null;
  type: string;
  payload: Record<string, unknown>;
  state: Record<string, unknown>;
  status: JobStatus;
  idempotencyKey: string | null;
  /** FAILURES so far. A wait-and-poll cycle is not a failure. */
  attempts: number;
  maxAttempts: number;
  agentRunId: number | null;
};

/** What a handler tells the worker to do next. */
export type HandlerOutcome =
  | { kind: "done"; result?: Record<string, unknown> }
  /** Not finished (e.g. waiting on the Intelligence Engine): run again after `afterSeconds`, keeping `state`. */
  | { kind: "wait"; afterSeconds: number; state: Record<string, unknown> };

export type JobContext = { job: JobRow; workspaceId: number; userId: number | null; log: Logger };

export type JobHandler = (ctx: JobContext) => Promise<HandlerOutcome>;

/**
 * Throw from a handler to control retry behaviour. Anything else that escapes a handler is treated as a
 * retryable bug (logged, backed off) — never a silent success.
 */
export class JobError extends Error {
  constructor(
    message: string,
    readonly opts: { retryable: boolean; retryAfterSeconds?: number } = { retryable: true },
  ) {
    super(message);
    this.name = "JobError";
  }
}

/** The job can never succeed (bad input, invalid engine output, quota exhausted): dead-letter it now. */
export class PermanentJobError extends JobError {
  constructor(message: string) {
    super(message, { retryable: false });
    this.name = "PermanentJobError";
  }
}
