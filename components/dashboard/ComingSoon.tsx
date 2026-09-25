import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { SHOW_LEGACY_MODULES } from "@/lib/feature-flags";
import type { NavIcon } from "@/lib/nav-config";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

/** Stub for a legacy (non-V1) module. Honest "not built" state — no sample content. */
export default function ComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: NavIcon;
}) {
  // Stub pages are not part of V1: 404 unless legacy modules are switched on.
  if (!SHOW_LEGACY_MODULES) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title={title} icon={icon} description={description} />
      <div className="flex flex-1 items-center justify-center px-4">
        <EmptyState
          icon={icon}
          title="This module is coming soon"
          description={`${title} is on the roadmap. Check back soon or reach out to the team for early access.`}
          actions={
            <Link href="/dashboard" className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to Command Center
            </Link>
          }
        >
          <span className="mt-5 inline-flex h-5 items-center rounded-md bg-neutral-100 px-1.5 text-[11px] font-medium text-neutral-500 ring-1 ring-inset ring-neutral-200/80">
            Legacy module
          </span>
        </EmptyState>
      </div>
    </div>
  );
}
