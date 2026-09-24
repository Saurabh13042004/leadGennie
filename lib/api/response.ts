import { ZodError } from "zod";
import { AppError, ERROR_STATUS, type ErrorCode, type ErrorDetail } from "./errors";
import type { Logger } from "@/lib/log";

/**
 * Response envelope (v1) — additive, so existing clients (the Chrome
 * extension, signup form, …) that read top-level fields keep working:
 *
 *   success: { ok: true, ...fields }
 *   failure: { ok: false, error: "<human message>", code: "<ErrorCode>",
 *              request_id: "<id>", details?: [{ path?, message }] }
 *
 * `error` stays a plain string on purpose; `code` is what programs switch on.
 */
export function ok<T extends Record<string, unknown>>(data?: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, ...(data ?? {}) }, init);
}

export function fail(
  code: ErrorCode,
  message: string,
  opts: { details?: ErrorDetail[]; requestId?: string; headers?: HeadersInit } = {},
): Response {
  return Response.json(
    {
      ok: false,
      error: message,
      code,
      ...(opts.requestId ? { request_id: opts.requestId } : {}),
      ...(opts.details ? { details: opts.details } : {}),
    },
    { status: ERROR_STATUS[code], headers: opts.headers },
  );
}

/** Zod issues → AppError(VALIDATION_ERROR); the first issue's message becomes the headline. */
export function fromZodError(err: ZodError): AppError {
  const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return new AppError("VALIDATION_ERROR", details[0]?.message ?? "Invalid request", details);
}

/** Converts anything thrown into a Response. Unknown errors are logged, never exposed. */
export function toResponse(
  err: unknown,
  ctx: { requestId?: string; log?: Logger; headers?: HeadersInit } = {},
): Response {
  const app = err instanceof AppError ? err : err instanceof ZodError ? fromZodError(err) : null;
  if (app) {
    return fail(app.code, app.message, { details: app.details, requestId: ctx.requestId, headers: ctx.headers });
  }
  ctx.log?.error("api.unhandled_error", { err });
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", {
    requestId: ctx.requestId,
    headers: ctx.headers,
  });
}
