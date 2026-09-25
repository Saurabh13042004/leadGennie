import Link from "next/link";
import { auth } from "@/auth";
import { listDomains } from "@/lib/actions/domains";
import { listMailboxes } from "@/lib/actions/mailboxes";
import DomainsPanel from "@/components/deliverability/DomainsPanel";
import ResendMailboxAdd from "@/components/deliverability/ResendMailboxAdd";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { Callout } from "@/components/settings/bits";

export const metadata = {
  title: "Domains & deliverability | LeadGennie",
};

export default async function Page() {
  const [session, domains, mailboxes] = await Promise.all([auth(), listDomains(), listMailboxes()]);
  const role = session?.user?.role;
  const canManage = role === "owner" || role === "admin";
  const resendMailboxes = mailboxes.filter((m) => m.provider === "resend");

  return (
    <SettingsFrame wide title="Domains & deliverability" description="Advanced: send from your own domain through Resend. This is the SPF / DKIM setup — most teams should connect an existing mailbox instead.">
      <div className="space-y-5">
        <Callout tone="info" role="note">
          Already use Gmail or Outlook for work? <Link href="/dashboard/deliverability" className="font-medium underline underline-offset-2">Connect that mailbox</Link> — no DNS records needed.
        </Callout>
        <DomainsPanel domains={domains} canAdd={canManage} canManage={canManage} />
        <ResendMailboxAdd domains={domains} existing={resendMailboxes.length} canAdd={role !== "viewer"} />
      </div>
    </SettingsFrame>
  );
}
