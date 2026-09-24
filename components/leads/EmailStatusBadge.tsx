import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; cls: string; hint: string }> = {
  unverified: { label: "Unverified", cls: "border-white/10 text-neutral-400", hint: "Syntax looks fine; deliverability not checked." },
  valid: { label: "Valid", cls: "border-green-500/30 text-green-300 bg-green-500/10", hint: "Domain accepts mail. The mailbox itself isn't verified." },
  risky: { label: "Risky", cls: "border-yellow-500/30 text-yellow-200 bg-yellow-500/10", hint: "Role account (info@, noreply@…) or disposable domain." },
  invalid: { label: "Invalid", cls: "border-red-500/30 text-red-300 bg-red-500/10", hint: "Not a deliverable address." },
};

export default function EmailStatusBadge({ status, blocked }: { status: string; blocked?: boolean }) {
  const s = STYLES[status] ?? STYLES.unverified;
  return (
    <span className="inline-flex items-center gap-1">
      <span title={s.hint} className={cn("text-[10px] border rounded px-1.5 py-0.5", s.cls)}>{s.label}</span>
      {blocked && (
        <span title="On your Do Not Contact list — can't be enrolled in campaigns." className="text-[10px] border rounded px-1.5 py-0.5 border-orange-500/30 text-orange-300 bg-orange-500/10">
          Blocked
        </span>
      )}
    </span>
  );
}
