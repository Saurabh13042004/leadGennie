import { Inbox } from "lucide-react";
import { auth } from "@/auth";
import { listSubmissions, listForms } from "@/lib/actions/forms";
import { listLeads } from "@/lib/actions/leads";
import { listMembers } from "@/lib/actions/workspace";
import InboxView from "@/components/inbox/InboxView";

export const metadata = {
  title: "Unified Inbox | LeadGennie",
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Inbox className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Unified Inbox</h1>
          <p className="text-sm text-neutral-500">Form submissions, unmatched, and awaiting review.</p>
        </div>
      </div>

      <InboxView
        submissions={submissions}
        forms={forms}
        leads={leads}
        members={members}
        canManage={canManage}
        canApprove={canApprove}
      />
    </div>
  );
}
