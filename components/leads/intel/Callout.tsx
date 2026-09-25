import type { ReactNode } from "react";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

export type CalloutTone = "info" | "warn" | "error" | "success" | "neutral";

const TONES: Record<CalloutTone, { box: string; icon: string }> = {
  info: { box: "bg-indigo-50/60 text-indigo-950 ring-indigo-200/70", icon: "text-indigo-500" },
  warn: { box: "bg-amber-50/70 text-amber-950 ring-amber-200/70", icon: "text-amber-500" },
  error: { box: "bg-rose-50/70 text-rose-950 ring-rose-200/70", icon: "text-rose-500" },
  success: { box: "bg-emerald-50/70 text-emerald-950 ring-emerald-200/70", icon: "text-emerald-500" },
  neutral: { box: "bg-neutral-50 text-neutral-700 ring-neutral-200/80", icon: "text-neutral-400" },
};

/** Inline notice: tinted surface, leading icon, optional bold title. Used for research state and evidence caveats. */
export default function Callout({
  tone = "info",
  icon: Icon,
  title,
  children,
  spin,
  role,
  className,
}: {
  tone?: CalloutTone;
  icon?: NavIcon;
  title?: ReactNode;
  children?: ReactNode;
  spin?: boolean;
  role?: "alert" | "status";
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div role={role} className={cn("flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed ring-1 ring-inset", t.box, className)}>
      {Icon && <Icon className={cn("mt-[3px] h-4 w-4 shrink-0", t.icon, spin && "animate-spin")} weight={spin ? "bold" : "fill"} />}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-xs opacity-80")}>{children}</div>}
      </div>
    </div>
  );
}
