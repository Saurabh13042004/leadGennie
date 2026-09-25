import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Surface with a hairline border and a whisper of shadow. */
export default function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>{children}</div>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Settings-style section: label + description on the left, content on the right (stacks on mobile). */
export function Section({ title, description, children, footer, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>
      <div className="grid gap-6 p-5 md:grid-cols-[220px_1fr] md:p-6">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      {footer && <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/60 px-5 py-3 md:px-6">{footer}</div>}
    </section>
  );
}
