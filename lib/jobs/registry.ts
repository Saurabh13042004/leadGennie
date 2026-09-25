import type { ZodType } from "zod";
import type { JobHandler, JobRow } from "./types";

const handlers = new Map<string, JobHandler>();
const payloadSchemas = new Map<string, ZodType>();

/**
 * Registry (open/closed): adding a job type is registering a handler — the worker never changes. An optional zod
 * `payload` schema is enforced before the handler runs: a malformed payload can never succeed, so it dead-letters at once.
 */
export function registerJobHandler(type: string, handler: JobHandler, opts: { payload?: ZodType } = {}): void {
  handlers.set(type, handler);
  if (opts.payload) payloadSchemas.set(type, opts.payload);
}

export function getJobPayloadSchema(type: string): ZodType | undefined {
  return payloadSchemas.get(type);
}

export function getJobHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}

export function registeredJobTypes(): string[] {
  return [...handlers.keys()];
}

type SettledHook = (job: JobRow) => Promise<void>;
const settledHooks: SettledHook[] = [];

/** Called by the worker after a job reaches a final state (succeeded / dead) — e.g. to close a batch run. */
export function onJobSettled(hook: SettledHook): void {
  if (!settledHooks.includes(hook)) settledHooks.push(hook);
}

export function jobSettledHooks(): readonly SettledHook[] {
  return settledHooks;
}

/** Tests only. */
export function clearJobHandlers(): void {
  handlers.clear();
  payloadSchemas.clear();
}
