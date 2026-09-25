import { auth } from "@/auth";
import { listDomains } from "@/lib/actions/domains";
import { listMailboxes } from "@/lib/actions/mailboxes";
import DeliverabilityView from "@/components/deliverability/DeliverabilityView";
import SettingsFrame from "@/components/settings/SettingsFrame";

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
    <SettingsFrame wide title="Mailboxes & domains" description="Sending domains, the mailboxes on them, and how much each can send per day.">
      <DeliverabilityView
        domains={domains}
        mailboxes={mailboxes}
        canAddDomain={canManage}
        canAddMailbox={canAddMailbox}
        canManage={canManage}
        canApprove={canManage}
      />
    </SettingsFrame>
  );
}
