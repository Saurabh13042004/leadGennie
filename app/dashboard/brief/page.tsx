import Link from "next/link";
import { Sun, ShieldAlert, Clock, Ban, CheckCircle2, ShieldCheck, CheckSquare } from "lucide-react";
import { auth } from "@/auth";
import { getTodaysBrief } from "@/lib/actions/brief";
import FailedSendsCard from "@/components/brief/FailedSendsCard";

export const metadata = {
  title: "Today's Brief | LeadGennie",
};

function EmptyModuleNote({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] px-4 py-4">
      <p className="text-sm text-neutral-400">
        <span className="text-white">{title}</span> isn&apos;t built yet — nothing to show here.
      </p>
    </div>
  );
}

export default async function TodaysBriefPage() {
  const [session, brief] = await Promise.all([auth(), getTodaysBrief()]);
  const canRetry = session?.user?.role !== "viewer";
  const canApprove = session?.user?.role === "owner" || session?.user?.role === "admin";
  const hasIssues =
    brief.failedTotal > 0 || brief.blockedTotal > 0 || brief.overdueCount > 0 || brief.pendingApprovals.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Sun className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Today&apos;s Brief</h1>
          <p className="text-sm text-neutral-500">Everything that needs your attention right now.</p>
        </div>
      </div>

      {!hasIssues && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          No failed sends, compliance blocks, pending approvals, or stuck jobs right now.
        </div>
      )}

      {brief.pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-500/20">
            <ShieldCheck className="w-4 h-4 text-purple-300 shrink-0" />
            <p className="text-sm text-purple-200 font-medium">
              {brief.pendingApprovals.length} launch{brief.pendingApprovals.length === 1 ? "" : "es"} waiting on
              {canApprove ? " your" : " an owner/admin's"} approval
            </p>
          </div>
          <div className="divide-y divide-purple-500/10">
            {brief.pendingApprovals.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{a.title}</p>
                  {a.summary && <p className="text-xs text-purple-200/70 truncate">{a.summary}</p>}
                </div>
                <Link
                  href="/dashboard/campaigns"
                  className="text-xs text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <FailedSendsCard groups={brief.failedGroups} canRetry={canRetry} />

      {brief.blockedTotal > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-yellow-500/20">
            <ShieldAlert className="w-4 h-4 text-yellow-300 shrink-0" />
            <p className="text-sm text-yellow-200 font-medium">
              {brief.blockedTotal} send{brief.blockedTotal === 1 ? "" : "s"} blocked by compliance rules
            </p>
          </div>
          <div className="divide-y divide-yellow-500/10">
            {brief.blockedGroups.map((g) => (
              <div key={`${g.campaignId}:${g.reason}`} className="px-4 py-3">
                <p className="text-sm text-white">{g.campaignName}</p>
                <p className="text-xs text-yellow-200/80">
                  {g.count}× — {g.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {brief.overdueCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {brief.overdueCount} scheduled send{brief.overdueCount === 1 ? " is" : "s are"} more than an hour
            overdue and haven&apos;t been picked up — check that the send-campaigns cron job is running.
          </span>
        </div>
      )}

      {brief.dncTotal > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0A0A0A] px-4 py-3 text-sm text-neutral-400">
          <Ban className="w-4 h-4 shrink-0" />
          <span>
            {brief.dncTotal} suppressed contact{brief.dncTotal === 1 ? "" : "s"} on your{" "}
            <Link href="/dashboard/do-not-contact" className="text-white hover:underline">
              Do Not Contact list
            </Link>
            .
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {brief.tasksToday === 0 && brief.tasksOverdue === 0 ? (
          <EmptyModuleNote title="Tasks" />
        ) : (
          <Link
            href="/dashboard/tasks"
            className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckSquare className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-white font-medium">Tasks</p>
            </div>
            <p className="text-xs text-neutral-400">
              {brief.tasksOverdue > 0 && <span className="text-orange-300">{brief.tasksOverdue} overdue</span>}
              {brief.tasksOverdue > 0 && brief.tasksToday > 0 && " · "}
              {brief.tasksToday > 0 && <span>{brief.tasksToday} due today</span>}
            </p>
          </Link>
        )}
        <EmptyModuleNote title="Meetings" />
        <EmptyModuleNote title="Fresh signals" />
      </div>
    </div>
  );
}
