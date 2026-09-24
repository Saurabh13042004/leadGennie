/**
 * Typed application errors. Throw an AppError anywhere under a `withApi`
 * handler and it becomes a structured JSON response with a stable `code`.
 * Anything that is NOT an AppError is treated as a bug: it is logged with the
 * request id and the client only ever sees a generic INTERNAL_ERROR (never a
 * message or stack trace).
 */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  PROVIDER_ERROR: 502,
  NOT_CONFIGURED: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ErrorDetail = { path?: string; message: string };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}
