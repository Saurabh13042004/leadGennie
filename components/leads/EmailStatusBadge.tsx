import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; cls: string; hint: string }> = {
  unverified: { label: "Unverified", cls: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200", hint: "Syntax looks fine; deliverability not checked." },
  valid: { label: "Valid", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", hint: "Domain accepts mail. The mailbox itself isn't verified." },
  risky: { label: "Risky", cls: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200", hint: "Role account (info@, noreply@…) or disposable domain." },
  invalid: { label: "Invalid", cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200", hint: "Not a deliverable address." },
};

export default function EmailStatusBadge({ status, blocked }: { status: string; blocked?: boolean }) {
  const s = STYLES[status] ?? STYLES.unverified;
  return (
    <span className="inline-flex items-center gap-1">
      <span title={s.hint} className={cn("text-[10px] rounded px-1.5 py-0.5 font-medium", s.cls)}>{s.label}</span>
      {blocked && (
        <span title="On your Do Not Contact list — can't be enrolled in campaigns." className="text-[10px] rounded px-1.5 py-0.5 font-medium bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200">
          Blocked
        </span>
      )}
    </span>
  );
}
