import { Activity, Handshake, CheckSquare, Megaphone, ShieldCheck, UserRound } from "lucide-react";
import { listActivities } from "@/lib/actions/activities";

export const metadata = {
  title: "Activities | LeadGennie",
};

const ENTITY_ICON: Record<string, typeof Handshake> = {
  deal: Handshake,
  task: CheckSquare,
  campaign: Megaphone,
  approval: ShieldCheck,
};

export default async function ActivitiesPage() {
  const activities = await listActivities();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Activities</h1>
          <p className="text-sm text-neutral-500">Immutable audit trail — who did what, and when.</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">No activity yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Actions across Deals, Tasks, Campaigns, and Approvals will show up here as they happen.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
          <div className="divide-y divide-white/5">
            {activities.map((a) => {
              const Icon = ENTITY_ICON[a.entityType] ?? UserRound;
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-neutral-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">{a.summary}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {a.actorName ?? "System"} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
