import { EnvelopeSimple, Globe, HourglassMedium, PaperPlaneTilt } from "@phosphor-icons/react/ssr";
import type { Domain } from "@/lib/actions/domains";
import type { Mailbox } from "@/lib/actions/mailboxes";
import Stat from "@/components/ui/Stat";
import DomainsPanel from "./DomainsPanel";
import MailboxesPanel from "./MailboxesPanel";

/** Summary tiles, then sending domains and mailboxes stacked (domains first — mailboxes depend on them). */
export default function DeliverabilityView({
  domains,
  mailboxes,
  canAddDomain,
  canAddMailbox,
  canManage,
  canApprove,
}: {
  domains: Domain[];
  mailboxes: Mailbox[];
  canAddDomain: boolean;
  canAddMailbox: boolean;
  canManage: boolean;
  canApprove: boolean;
}) {
  const active = mailboxes.filter((m) => m.status === "active");
  const totalPending = mailboxes.filter((m) => m.status === "pending_approval").length;
  const dailyCapacity = active.reduce((acc, m) => acc + m.dailyLimit, 0);
  const sentToday = mailboxes.reduce((acc, m) => acc + m.sentToday, 0);
  const verified = domains.filter((d) => d.status === "verified").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Verified domains" value={`${verified}/${domains.length}`} icon={Globe} tone="emerald" />
        <Stat label="Active mailboxes" value={`${active.length}/${mailboxes.length}`} icon={EnvelopeSimple} tone="indigo" />
        <Stat label="Pending approval" value={totalPending} icon={HourglassMedium} tone="amber" />
        <Stat label="Sent today" value={`${sentToday}/${dailyCapacity}`} sub="of active daily capacity" icon={PaperPlaneTilt} tone="sky" />
      </div>

      <DomainsPanel domains={domains} canAdd={canAddDomain} canManage={canManage} />
      <MailboxesPanel mailboxes={mailboxes} domains={domains} canAdd={canAddMailbox} canManage={canManage} canApprove={canApprove} />
    </div>
  );
}
