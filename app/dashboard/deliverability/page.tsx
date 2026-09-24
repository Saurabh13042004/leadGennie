import { Mail } from "lucide-react";
import { auth } from "@/auth";
import { listDomains } from "@/lib/actions/domains";
import { listMailboxes } from "@/lib/actions/mailboxes";
import DeliverabilityView from "@/components/deliverability/DeliverabilityView";

export const metadata = {
  title: "Email Deliverability | LeadGennie",
};

export default async function Page() {
  const [session, domains, mailboxes] = await Promise.all([auth(), listDomains(), listMailboxes()]);
  const role = session?.user?.role;
  const canManage = role === "owner" || role === "admin";
  // requestAddMailbox is member+ (creation always needs a separate approval);
  // addDomain/removeDomain/verify are admin+ — matches the actions' own gates.
  const canAddMailbox = role !== "viewer";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Email Deliverability</h1>
          <p className="text-sm text-neutral-500">Mailboxes, domains & warmup</p>
        </div>
      </div>

      <DeliverabilityView
        domains={domains}
        mailboxes={mailboxes}
        canAddDomain={canManage}
        canAddMailbox={canAddMailbox}
        canManage={canManage}
        canApprove={canManage}
      />
    </div>
  );
}
