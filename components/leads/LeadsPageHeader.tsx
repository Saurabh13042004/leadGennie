import type { ReactNode } from "react";
import { UsersThree } from "@phosphor-icons/react/ssr";
import PageHeader from "@/components/ui/PageHeader";
import LeadsSubNav from "./LeadsSubNav";

/** Shared header for the four Leads views: title, optional count/actions, and the view tabs. */
export default function LeadsPageHeader({ count, description, actions }: { count?: number; description?: ReactNode; actions?: ReactNode }) {
  return (
    <PageHeader title="Leads" icon={UsersThree} count={count} description={description} actions={actions}>
      <LeadsSubNav />
    </PageHeader>
  );
}
