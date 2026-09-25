import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CheckCircle, CircleNotch, Info, WarningCircle } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

/** Small shared pieces for the settings pages (server- and client-safe: no hooks). */

export function Spinner({ className }: { className?: string }) {
  return <CircleNotch className={cn("h-4 w-4 animate-spin", className)} weight="bold" />;
}

const CALLOUT = {
  error: { cls: "bg-rose-50 text-rose-700 ring-rose-200/70", icon: WarningCircle },
  success: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", icon: CheckCircle },
  warning: { cls: "bg-amber-50 text-amber-800 ring-amber-200/70", icon: WarningCircle },
  info: { cls: "bg-indigo-50 text-indigo-700 ring-indigo-200/70", icon: Info },
} as const;

/** Inline message strip (errors, confirmations, notes). */
export function Callout({ tone = "error", children, className, role }: { tone?: keyof typeof CALLOUT; children: ReactNode; className?: string; role?: string }) {
  const { cls, icon: I } = CALLOUT[tone];
  return (
    <div role={role ?? (tone === "error" ? "alert" : undefined)} className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] ring-1 ring-inset", cls, className)}>
      <I className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Square icon-only button for table rows and toolbars. */
export function IconButton({
  icon: I,
  label,
  tone = "neutral",
  busy,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: NavIcon; label: string; tone?: "neutral" | "danger"; busy?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors disabled:pointer-events-none disabled:opacity-50",
        tone === "danger" ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-neutral-100 hover:text-neutral-900",
        className,
      )}
      {...rest}
    >
      {busy ? <Spinner className="h-3.5 w-3.5" /> : <I className="h-3.5 w-3.5" weight="bold" />}
    </button>
  );
}

/** Table header cell / body cell paddings shared by settings tables. */
export const TH = "px-4 py-2 text-left text-xs font-medium text-neutral-500 first:pl-4 md:first:pl-5 last:pr-4 md:last:pr-5";
export const TD = "px-4 py-3 align-middle first:pl-4 md:first:pl-5 last:pr-4 md:last:pr-5";
export const THEAD_ROW = "border-b border-neutral-200/80 bg-neutral-50/60";

/** Compact relative time ("3m ago", "2d ago"); falls back to a date after a week. */
export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(iso);
}

export function shortDate(iso: string) {
  // Fixed locale + UTC so server and client render the same text (no hydration mismatch).
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Icon tile used in lists (settings index, integrations, prompts). */
export function IconTile({ icon: I, className }: { icon: NavIcon; className?: string }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      <I className="h-4 w-4" weight="duotone" />
    </span>
  );
}
