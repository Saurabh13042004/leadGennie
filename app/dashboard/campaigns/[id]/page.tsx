import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  CalendarBlank,
  ClockCountdown,
  EnvelopeSimple,
  Gauge,
  Megaphone,
  PaperPlaneTilt,
  Prohibit,
  RocketLaunch,
  Timer,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getCampaignDetailView } from "@/lib/actions/campaign-builder";
import { AppError } from "@/lib/api/errors";
import type { NavIcon } from "@/lib/nav-config";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import { SidebarSection } from "@/components/leads/LeadProperties";
import SendIssuesCard from "@/components/campaigns/detail/SendIssuesCard";
import CampaignActions from "@/components/campaigns/detail/CampaignActions";
import ApprovalSummary from "@/components/campaigns/detail/ApprovalSummary";
import CampaignLeadsTable from "@/components/campaigns/detail/CampaignLeadsTable";
import { Notice, StatusBadge, formatWhen } from "@/components/campaigns/builder/ui";

export const metadata = {
  title: "Campaign | LeadGennie",
};

const LEAD_STATUSES = ["pending", "active", "replied", "completed", "stopped", "bounced", "unsubscribed", "blocked", "failed"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** 24 is the end of the day, not midnight at the start of it. */
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Prop({ icon: Icon, label, children }: { icon: NavIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 py-1.5">
      <dt className="flex items-center gap-2 pt-px text-neutral-500">
        <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" weight="duotone" />
        {label}
      </dt>
      <dd className="min-w-0 text-neutral-900">{children}</dd>
    </div>
  );
}

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const { status: rawFilter } = await searchParams;
  const filter = rawFilter && LEAD_STATUSES.includes(rawFilter) ? rawFilter : null;
  const [session, detail] = await Promise.all([
    auth(),
    getCampaignDetailView(id, { status: filter ?? undefined }).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
  ]);
  const role = session?.user?.role;
  const { campaign: c, sendCounts, messages } = detail;
  const wentOut = messages.sent + messages.delivered + messages.bounced + messages.complained;
  const launched = !["draft", "pending_approval", "ready", "rejected"].includes(c.status);
  const w = c.sendWindow;

  return (
    <>
      <PageHeader
        title={c.name}
        icon={Megaphone}
        crumbs={[{ label: "Campaigns", href: "/dashboard/campaigns" }]}
        actions={
          <>
            <StatusBadge status={c.status} />
            <CampaignActions
              id={c.id} status={c.status} sendModel={c.sendModel} approvalId={detail.approval?.id ?? null} approvalPending={detail.approval?.status === "pending"}
              canEdit={role !== "viewer"} canApprove={role === "owner" || role === "admin"}
            />
          </>
        }
      />

      <div className="grid lg:min-h-[calc(100%-57px)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 px-4 py-5 md:px-6 lg:py-6">
          {c.sendModel === "legacy" && <Notice tone="info" title="Created with the previous campaign wizard">It keeps sending as before. To change its content, create a new campaign.</Notice>}
          {c.status === "paused" && c.pausedReason && <Notice tone="warn" title="Paused automatically">{c.pausedReason}</Notice>}
          {detail.health.workerStalled && c.status === "running" && (
            <Notice tone="warn" title="The sending worker doesn't seem to be running">{detail.health.dueNow} email(s) are due but nothing has been picked up for a few minutes. Start the worker (<code>npm run worker</code>) or point a cron at <code>/api/jobs/tick</code>.</Notice>
          )}
          {wentOut === 0 && detail.nextSendUpcoming && detail.nextSendAt && (
            <Notice tone="info" title="Nothing has gone out yet — the first email is scheduled">
              It&apos;s set for {new Date(detail.nextSendAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: w.timezone })} ({w.timezone}),
              when your send window ({w.days.map((d) => DAYS[d]).join(", ")} {hh(w.startHour)}–{hh(w.endHour)}) next opens. Nothing sends before then, and it only goes out while the sending worker is running.
            </Notice>
          )}
          {c.status === "ready" && <Notice tone="info" title="Approved">Nothing sends until someone clicks Launch.</Notice>}
          {(c.status === "draft" || c.status === "rejected") && <Notice tone="info" title="Not submitted yet">Finish the builder and submit it for approval — nothing is sent from a draft.</Notice>}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Enrolled" value={launched ? c.totalLeads.toLocaleString() : "—"} icon={UsersThree} tone="indigo" sub={launched && c.blockedCount > 0 ? `${c.blockedCount} excluded` : undefined} />
            <Stat label="Sent" value={wentOut.toLocaleString()} icon={PaperPlaneTilt} tone="emerald" sub={`${(sendCounts.pending ?? 0).toLocaleString()} scheduled${detail.nextSendAt ? ` · next ${formatWhen(detail.nextSendAt)}` : ""}`} />
            <Stat label="Delivered" value={(messages.delivered + messages.bounced + messages.complained > 0 ? messages.delivered : "—").toLocaleString()} icon={ClockCountdown} tone="sky" sub="confirmed by the provider" />
            <Stat label="Bounced" value={(messages.bounced + messages.complained).toLocaleString()} icon={Prohibit} tone="amber" sub={`${messages.complained} spam complaint${messages.complained === 1 ? "" : "s"} · ${messages.failed + (sendCounts.blocked ?? 0)} failed or blocked`} />
          </div>
          <p className="px-1 text-xs text-neutral-400">Replies and opens appear once inbox sync is connected — until then they aren&apos;t shown, rather than shown as zero.</p>

          <SendIssuesCard failed={detail.failedSends} deadJobs={detail.deadJobs} canAct={role !== "viewer"} />
          {detail.approval && <ApprovalSummary approval={detail.approval} />}
          <CampaignLeadsTable id={c.id} rows={detail.leads} counts={detail.leadCounts} filter={filter} steps={c.steps.length} />

          <Card>
            <CardHeader title="Activity" />
            {detail.activity.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-neutral-500">Nothing yet.</p>
            ) : (
              <ol className="divide-y divide-neutral-100">
                {detail.activity.map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-28 shrink-0 pt-px text-xs tabular-nums text-neutral-400">{formatWhen(a.at)}</span>
                    <span className="min-w-0 text-neutral-700">{a.summary}{a.actor ? <span className="text-neutral-400"> — {a.actor}</span> : null}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="order-first border-b border-neutral-200/80 bg-neutral-50/40 lg:order-none lg:border-b-0 lg:border-l">
          <SidebarSection title="Properties">
            <dl className="text-[13px]">
              <Prop icon={EnvelopeSimple} label="From">{c.fromEmail ?? <span className="text-neutral-300">—</span>}</Prop>
              <Prop icon={Megaphone} label="Sequence">{c.steps.length} email{c.steps.length === 1 ? "" : "s"}{c.steps[0]?.mode === "personalized" ? ", first personalised" : ""}</Prop>
              <Prop icon={Gauge} label="Limits">{c.dailyLimit}/day{c.totalLimit ? ` · ${c.totalLimit} max` : ""}</Prop>
              <Prop icon={Timer} label="Window">{w.days.map((d) => DAYS[d]).join(", ")} · {hh(w.startHour)}–{hh(w.endHour)}<span className="block text-xs text-neutral-400">{w.timezone}</span></Prop>
              <Prop icon={RocketLaunch} label="Launched">{c.startedAt ? formatWhen(c.startedAt) : <span className="text-neutral-300">—</span>}</Prop>
              <Prop icon={CalendarBlank} label="Created">{new Date(c.createdAt).toLocaleDateString()}</Prop>
            </dl>
          </SidebarSection>
          <SidebarSection title="Emails">
            <ol className="space-y-1.5">
              {c.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold tabular-nums text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-neutral-700">{i === 0 && s.mode === "personalized" ? "Personalised per lead" : (i === 0 && s.subject.trim()) || s.body.trim().split("\n")[0] || "No message yet"}</span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">{i === 0 ? "Day 0" : `+${s.waitDays}d`}</span>
                </li>
              ))}
            </ol>
          </SidebarSection>
        </aside>
      </div>
    </>
  );
}
