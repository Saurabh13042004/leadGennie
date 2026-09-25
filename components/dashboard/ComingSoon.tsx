import { notFound } from "next/navigation";
import { SHOW_LEGACY_MODULES } from "@/lib/feature-flags";
import type { NavIcon } from "@/lib/nav-config";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
    <>
      <PageHeader title={title} icon={icon} description={description} />
      <EmptyState
        icon={icon}
        title="This module is coming soon"
        description={`${title} is on the roadmap. Check back soon or reach out to the team for early access.`}
      />
    </>
  );
}
