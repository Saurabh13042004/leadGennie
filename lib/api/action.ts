import { ZodError } from "zod";
import { AppError, type ErrorCode, type ErrorDetail } from "./errors";
import { fromZodError } from "./response";
import { createLogger } from "@/lib/log";

/**
 * Server-action envelope — the action-side twin of the route envelope in
 * response.ts. Next.js redacts the message of any error thrown from a server
 * action in production, so actions that need to show the user *why* something
 * failed return this instead of throwing:
 *
 *   { ok: true, data } | { ok: false, error: { code, message, details? } }
 *
 * Anything that isn't an AppError is a bug: it is logged and the caller only
 * ever sees INTERNAL_ERROR.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; details?: ErrorDetail[] } };

const log = createLogger({ scope: "server-action" });

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const app = err instanceof AppError ? err : err instanceof ZodError ? fromZodError(err) : null;
    if (app) return { ok: false, error: { code: app.code, message: app.message, ...(app.details ? { details: app.details } : {}) } };
    log.error("action.unhandled_error", { err });
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
  }
}

/** For client code: unwrap or throw a plain Error carrying the safe message. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
