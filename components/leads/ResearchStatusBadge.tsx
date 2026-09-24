import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  none: "Not researched",
  queued: "Queued",
  running: "Researching…",
  done: "Researched",
  partial: "Partial",
  failed: "Failed",
};

const TONE: Record<string, string> = {
  none: "text-neutral-400",
  queued: "text-indigo-600",
  running: "text-indigo-600",
  done: "text-neutral-600",
  partial: "text-amber-600",
  failed: "text-rose-600",
};

export default function ResearchStatusBadge({ status, className }: { status: string; className?: string }) {
  const busy = status === "queued" || status === "running";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", TONE[status] ?? "text-neutral-500", className)}>
      {busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
      {LABEL[status] ?? status}
    </span>
  );
}
