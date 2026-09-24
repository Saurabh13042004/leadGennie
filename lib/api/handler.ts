import type { ZodType } from "zod";
import { createLogger, type Logger } from "@/lib/log";
import { AppError } from "./errors";
import { fromZodError, toResponse } from "./response";

export type ApiContext = { requestId: string; log: Logger };

/**
 * Wraps a route handler so that:
 *  - every request gets a request id (echoed in `x-request-id`, in error
 *    bodies, and on every log line)
 *  - anything thrown becomes a structured error response (see response.ts)
 *  - unexpected errors are logged with the id, never leaked to the client
 *
 * `extraHeaders` are added to every response including errors (e.g. CORS).
 */
export function withApi<C = unknown>(
  handler: (request: Request, routeCtx: C, api: ApiContext) => Promise<Response>,
  opts: { extraHeaders?: Record<string, string> } = {},
) {
  return async (request: Request, routeCtx: C): Promise<Response> => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const url = new URL(request.url);
    const log = createLogger({ request_id: requestId, method: request.method, path: url.pathname });

    let response: Response;
    try {
      response = await handler(request, routeCtx, { requestId, log });
    } catch (err) {
      response = toResponse(err, { requestId, log });
    }
    for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) response.headers.set(k, v);
    response.headers.set("x-request-id", requestId);
    return response;
  };
}

/** Parses the request body as JSON and validates it. Bad JSON → 400, bad shape → 422. */
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw fromZodError(parsed.error);
  return parsed.data;
}
