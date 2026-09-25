import type { ReactNode } from "react";
import { GearSix } from "@phosphor-icons/react/ssr";
import PageHeader from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import SettingsNav from "./SettingsNav";

/**
 * Layout for every settings page: sticky "Settings / <page>" header, a left sub-nav,
 * and a readable content column with the page title and one line of description.
 */
export default function SettingsFrame({
  title,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Primary actions for this page, shown next to the page title. */
  actions?: ReactNode;
  /** Use the full content width (tables, editors) instead of the reading column. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} icon={GearSix} crumbs={[{ label: "Settings", href: "/dashboard/settings" }]} />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-10 md:px-6 md:py-8">
        <aside className="md:sticky md:top-20 md:h-fit md:w-52 md:shrink-0">
          <SettingsNav />
        </aside>
        <div className={cn("min-w-0 flex-1", !wide && "max-w-3xl")}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200/80 pb-5">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h2>
              {description && <p className="mt-1 text-[13px] text-neutral-500">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
