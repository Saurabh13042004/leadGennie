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
  none: "text-neutral-600",
  queued: "text-blue-300",
  running: "text-blue-300",
  done: "text-neutral-300",
  partial: "text-yellow-200",
  failed: "text-red-300",
};

export default function ResearchStatusBadge({ status, className }: { status: string; className?: string }) {
  const busy = status === "queued" || status === "running";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", TONE[status] ?? "text-neutral-400", className)}>
      {busy && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
      {LABEL[status] ?? status}
    </span>
  );
}
