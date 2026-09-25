import { Prohibit, Question, SealCheck, Warning, XCircle } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; icon: NavIcon; cls: string; hint: string }> = {
  unverified: { label: "Unverified", icon: Question, cls: "text-neutral-500", hint: "Syntax looks fine; deliverability not checked." },
  valid: { label: "Valid", icon: SealCheck, cls: "text-emerald-600", hint: "Domain accepts mail. The mailbox itself isn't verified." },
  risky: { label: "Risky", icon: Warning, cls: "text-amber-600", hint: "Role account (info@, noreply@…) or disposable domain." },
  invalid: { label: "Invalid", icon: XCircle, cls: "text-rose-600", hint: "Not a deliverable address." },
};

export default function EmailStatusBadge({ status, blocked }: { status: string; blocked?: boolean }) {
  const s = STYLES[status] ?? STYLES.unverified;
  const I = s.icon;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span title={s.hint} className={cn("inline-flex items-center gap-1 text-xs font-medium", s.cls)}>
        <I className="h-3.5 w-3.5" weight="fill" />
        {s.label}
      </span>
      {blocked && (
        <span title="On your Do Not Contact list — can't be enrolled in campaigns." className="inline-flex h-5 items-center gap-1 rounded-md bg-orange-50 px-1.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200/70">
          <Prohibit className="h-3 w-3" weight="bold" />
          Blocked
        </span>
      )}
    </span>
  );
}
