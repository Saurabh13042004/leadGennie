"use client";

import Link from "next/link";
import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react/ssr";
import EmptyState from "@/components/ui/EmptyState";
import Button, { buttonClasses } from "@/components/ui/Button";

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
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <EmptyState
        icon={WarningCircle}
        title="Something went wrong"
        description="This page hit an unexpected error. Your data is safe — try again, and if it keeps happening let us know."
        actions={
          <>
            <Button variant="primary" onClick={() => unstable_retry()}>
              <ArrowClockwise className="h-4 w-4" weight="bold" />
              Try again
            </Button>
            <Link href="/dashboard" className={buttonClasses({ variant: "secondary" })}>
              Back to Command Center
            </Link>
          </>
        }
      >
        {error.digest && (
          <p className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-neutral-50 px-2 py-1 font-mono text-[11px] text-neutral-500 ring-1 ring-inset ring-neutral-200/80">
            <span className="font-sans text-neutral-400">Reference</span> {error.digest}
          </p>
        )}
      </EmptyState>
    </div>
  );
}
