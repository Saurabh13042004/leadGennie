import type { Instrumentation } from "next";

/**
 * Every unhandled server error (page render, route handler, server action)
 * lands here — logged as one structured line with Next's error digest, which
 * is also what the user sees on the error boundary, so a support report
 * ("reference 1234") maps straight to the log line and stack.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { createLogger } = await import("@/lib/log");
  createLogger({ path: request.path, method: request.method }).error("server.unhandled_error", {
    err,
    digest: (err as { digest?: string }).digest,
    route: context.routePath,
    route_type: context.routeType,
    router: context.routerKind,
  });
};
