import Link from "next/link";
import { CaretRight, EnvelopeSimple, Gauge, PaperPlaneTilt, Warning } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getConnectAvailability, listMailboxes } from "@/lib/actions/mailboxes";
import { connectErrorMessage, isConnectErrorCode } from "@/lib/domain/mailboxes/oauth/messages";
import { isOAuthSlug, OAUTH_SLUGS } from "@/lib/domain/mailboxes/oauth/slug";
import ConnectMailboxCards from "@/components/mailboxes/ConnectMailboxCards";
import MailboxesPanel from "@/components/mailboxes/MailboxesPanel";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { Callout } from "@/components/settings/bits";
import Card from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";

export const metadata = {
  title: "Mailboxes | LeadGennie",
};

type Search = { mailbox_connected?: string; mailbox_error?: string; provider?: string; outcome?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const [session, mailboxes, availability] = await Promise.all([auth(), listMailboxes(), getConnectAvailability()]);
  const role = session?.user?.role;
  const canManage = role === "owner" || role === "admin";
  const provider = q.provider && isOAuthSlug(q.provider) ? OAUTH_SLUGS[q.provider] : undefined;

  const sendable = mailboxes.filter((m) => m.sendable);
  const needsAttention = mailboxes.filter((m) => m.status === "reconnect_required" || m.status === "error").length;
  const capacity = sendable.reduce((n, m) => n + m.dailyLimit, 0);
  const sentToday = mailboxes.reduce((n, m) => n + m.sentToday, 0);

  return (
    <SettingsFrame wide title="Mailboxes" description="Connect the mailbox you already use for work. LeadGennie uses it to send campaigns and manage replies.">
      <div className="space-y-5">
        {q.mailbox_connected && (
          <Callout tone="success" role="status">
            {q.outcome === "reconnected" ? "Mailbox reconnected." : "Connected."} LeadGennie can now send outreach from this mailbox — send yourself a test email below to check.
          </Callout>
        )}
        {q.mailbox_error && isConnectErrorCode(q.mailbox_error) && <Callout>{connectErrorMessage(q.mailbox_error, provider)}</Callout>}

        <section className="space-y-3">
          <h3 className="px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Connect a mailbox</h3>
          <ConnectMailboxCards availability={availability} canConnect={canManage} />
          <p className="px-1 text-xs text-neutral-500">You sign in with Google or Microsoft — LeadGennie never sees your password, and only asks for permission to send email.</p>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Ready to send" value={`${sendable.length}/${mailboxes.length}`} icon={EnvelopeSimple} tone="indigo" />
          <Stat label="Daily capacity" value={capacity} sub="emails per day" icon={Gauge} tone="emerald" />
          <Stat label="Sent today" value={sentToday} icon={PaperPlaneTilt} tone="sky" />
          <Stat label="Need attention" value={needsAttention} icon={Warning} tone={needsAttention ? "amber" : "emerald"} />
        </div>

        <MailboxesPanel mailboxes={mailboxes} canManage={canManage} canTest={role !== "viewer"} canApprove={canManage} />

        <Link href="/dashboard/domains" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-neutral-50/70">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-neutral-900">Other sending methods</p>
              <p className="text-xs text-neutral-500">Advanced: send from your own domain through Resend, with SPF/DKIM records you manage.</p>
            </div>
            <CaretRight className="h-4 w-4 text-neutral-400" weight="bold" />
          </Card>
        </Link>
      </div>
    </SettingsFrame>
  );
}
