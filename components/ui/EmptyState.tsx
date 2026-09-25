import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; weight?: "duotone" | "fill" | "regular" | "bold" }>;

/** Centered empty/zero state: layered icon mark, title, one line of guidance, optional actions. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  children,
  className,
  compact,
}: {
  icon: IconType;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-6 py-10" : "px-6 py-20", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-b from-indigo-100/70 to-transparent blur-md" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(79,70,229,0.18)] ring-1 ring-neutral-200/80">
          <Icon className="h-6 w-6 text-indigo-600" weight="duotone" />
        </div>
      </div>
      <p className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      {children}
    </div>
  );
}
