import { auth } from "@/auth";
import { listSubmissions, listForms } from "@/lib/actions/forms";
import { listLeads } from "@/lib/actions/leads";
import { listMembers } from "@/lib/actions/workspace";
import InboxView from "@/components/inbox/InboxView";
import LeadsPageHeader from "@/components/leads/LeadsPageHeader";

export const metadata = {
  title: "Inbound | LeadGennie",
};

export default async function Page() {
  const [session, submissions, forms, leads, members] = await Promise.all([
    auth(),
    listSubmissions(),
    listForms(),
    listLeads(),
    listMembers(),
  ]);
  const role = session?.user?.role;
  const canManage = role !== "viewer";
  const canApprove = role === "owner" || role === "admin";

  return (
    <>
      <LeadsPageHeader description="Form submissions that are unmatched or awaiting review" />
      <InboxView
        submissions={submissions}
        forms={forms}
        leads={leads}
        members={members}
        canManage={canManage}
        canApprove={canApprove}
      />
    </>
  );
}
