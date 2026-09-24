"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Catches any error thrown while rendering a dashboard page so users get a
 * recoverable message instead of a stack trace. In production Next strips the
 * error message and supplies a `digest`, which matches the server log line
 * written by instrumentation.ts.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] flex flex-col items-center text-center py-16 px-6">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h1 className="text-white font-medium">Something went wrong</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          This page hit an unexpected error. Your data is safe — try again, and if it keeps happening let us know.
        </p>
        {error.digest && (
          <p className="text-xs text-neutral-600 mt-3 font-mono">Reference: {error.digest}</p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="mt-6 flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
