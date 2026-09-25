import { CircleNotch } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  none: "Not researched",
  queued: "Queued",
  running: "Researching…",
  done: "Researched",
  partial: "Partial",
  failed: "Failed",
};

const TONE: Record<string, { text: string; dot: string }> = {
  none: { text: "text-neutral-400", dot: "bg-neutral-300" },
  queued: { text: "text-indigo-600", dot: "bg-indigo-400" },
  running: { text: "text-indigo-600", dot: "bg-indigo-500" },
  done: { text: "text-neutral-700", dot: "bg-emerald-500" },
  partial: { text: "text-amber-700", dot: "bg-amber-500" },
  failed: { text: "text-rose-600", dot: "bg-rose-500" },
};

export default function ResearchStatusBadge({ status, className }: { status: string; className?: string }) {
  const busy = status === "queued" || status === "running";
  const t = TONE[status] ?? { text: "text-neutral-500", dot: "bg-neutral-400" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", t.text, className)}>
      {busy ? <CircleNotch className="h-3 w-3 animate-spin" weight="bold" aria-hidden /> : <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />}
      {LABEL[status] ?? status}
    </span>
  );
}
