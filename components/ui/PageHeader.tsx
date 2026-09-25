import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; weight?: "duotone" | "fill" | "regular" | "bold" }>;

/**
 * Sticky page header inside the content panel: breadcrumb/title row with actions on the right,
 * and an optional second row (tabs, toolbar) passed as children.
 */
export default function PageHeader({
  title,
  icon: Icon,
  crumbs,
  count,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  icon?: IconType;
  crumbs?: { label: string; href: string }[];
  count?: number | string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-20 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md", className)}>
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200/70">
              <Icon className="h-4 w-4" weight="duotone" />
            </span>
          )}
          {crumbs?.map((c) => (
            <span key={c.href} className="flex items-center gap-2">
              <Link href={c.href} className="truncate text-[13px] text-neutral-500 transition-colors hover:text-neutral-900">
                {c.label}
              </Link>
              <CaretRight className="h-3 w-3 text-neutral-300" weight="bold" />
            </span>
          ))}
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h1>
          {count !== undefined && (
            <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500">{count}</span>
          )}
          {description && <span className="hidden truncate text-[13px] text-neutral-400 lg:inline">· {description}</span>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="px-4 md:px-6">{children}</div>}
    </header>
  );
}
