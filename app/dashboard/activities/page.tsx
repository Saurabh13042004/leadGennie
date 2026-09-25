import {
  Buildings,
  CheckSquare,
  ClockCounterClockwise,
  EnvelopeSimple,
  Handshake,
  Key,
  Megaphone,
  PencilSimpleLine,
  Prohibit,
  Pulse,
  Robot,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import { listActivities, type ActivityRow } from "@/lib/actions/activities";
import type { NavIcon } from "@/lib/nav-config";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { timeAgo } from "@/components/settings/bits";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "Activities | LeadGennie",
};

/** Icon + tint per activity type (falls back to the entity type, then a neutral pulse). */
function activityIcon(a: ActivityRow): { icon: NavIcon; cls: string } {
  const key = `${a.type} ${a.entityType}`;
  if (a.type.startsWith("draft")) return { icon: PencilSimpleLine, cls: "bg-violet-50 text-violet-600 ring-violet-100" };
  if (a.type.startsWith("lead") || a.entityType === "lead") return { icon: UsersThree, cls: "bg-sky-50 text-sky-600 ring-sky-100" };
  if (key.includes("campaign")) return { icon: Megaphone, cls: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
  if (key.includes("approval")) return { icon: ShieldCheck, cls: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  if (key.includes("mailbox") || key.includes("domain")) return { icon: EnvelopeSimple, cls: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (key.includes("dnc") || key.includes("do_not_contact")) return { icon: Prohibit, cls: "bg-rose-50 text-rose-600 ring-rose-100" };
  if (key.includes("prompt")) return { icon: Robot, cls: "bg-violet-50 text-violet-600 ring-violet-100" };
  if (key.includes("token") || key.includes("api")) return { icon: Key, cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" };
  if (key.includes("deal")) return { icon: Handshake, cls: "bg-orange-50 text-orange-600 ring-orange-100" };
  if (key.includes("task")) return { icon: CheckSquare, cls: "bg-teal-50 text-teal-600 ring-teal-100" };
  if (key.includes("workspace")) return { icon: Buildings, cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" };
  return { icon: Pulse, cls: "bg-neutral-100 text-neutral-500 ring-neutral-200" };
}

function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function groupByDay(rows: ActivityRow[]) {
  const groups: { label: string; items: ActivityRow[] }[] = [];
  for (const a of rows) {
    const label = dayLabel(new Date(a.createdAt));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }
  return groups;
}

export default async function ActivitiesPage() {
  const activities = await listActivities();
  const groups = groupByDay(activities);

  return (
    <SettingsFrame title="Activity log" description="Immutable audit trail — who did what, and when.">
      {activities.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={ClockCounterClockwise}
            title="No activity yet"
            description="Imports, launches, approvals and settings changes show up here as they happen."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                {g.label}
                <span className="rounded bg-neutral-100 px-1 text-[10px] tabular-nums text-neutral-500">{g.items.length}</span>
              </h3>
              <Card>
                <ul className="px-4 py-1.5">
                  {g.items.map((a, i) => {
                    const { icon: I, cls } = activityIcon(a);
                    const actor = a.actorName ?? "System";
                    return (
                      <li key={a.id} className="relative flex gap-3 py-2.5">
                        {i < g.items.length - 1 && <span className="absolute left-[13px] top-9 h-[calc(100%-24px)] w-px bg-neutral-100" aria-hidden />}
                        <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${cls}`}>
                          <I className="h-3.5 w-3.5" weight="duotone" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-[13px] text-neutral-800">{a.summary}</p>
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
                            {a.actorName ? <Avatar name={actor} size="xs" /> : null}
                            <span className="font-medium text-neutral-500">{actor}</span>
                            <span>·</span>
                            <span className="font-mono text-[10px] text-neutral-400">{a.type}</span>
                          </p>
                        </div>
                        <time
                          dateTime={a.createdAt}
                          title={new Date(a.createdAt).toLocaleString()}
                          className="shrink-0 pt-0.5 text-[11px] tabular-nums text-neutral-400"
                        >
                          {timeAgo(a.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </SettingsFrame>
  );
}
