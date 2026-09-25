import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChatCircleDots,
  Clock,
  EnvelopeSimple,
  Megaphone,
  PaperPlaneTilt,
  PencilSimpleLine,
  Pulse,
  ShieldCheck,
  Sparkle,
  UploadSimple,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import type { ReactNode } from "react";
import type { InsightBoardData, StatCardData } from "@/lib/actions/insights";
import type { ActivityRow } from "@/lib/actions/activities";
import Card, { CardHeader } from "@/components/ui/Card";
import Stat from "@/components/ui/Stat";
import { Kbd } from "@/components/ui/Field";
import OutreachCard from "./OutreachCard";

const num = (s: string | undefined) => Number((s ?? "0").replace(/[^0-9.]/g, "")) || 0;
const pick = (list: StatCardData[], label: string) => list.find((m) => m.label === label);

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function activityIcon(type: string): { icon: NavIcon; cls: string } {
  if (type.startsWith("lead")) return { icon: UsersThree, cls: "bg-sky-50 text-sky-600" };
  if (type.startsWith("campaign")) return { icon: Megaphone, cls: "bg-indigo-50 text-indigo-600" };
  if (type.startsWith("draft")) return { icon: PencilSimpleLine, cls: "bg-violet-50 text-violet-600" };
  if (type.startsWith("approval")) return { icon: ShieldCheck, cls: "bg-emerald-50 text-emerald-600" };
  return { icon: Pulse, cls: "bg-neutral-100 text-neutral-500" };
}

const SHORTCUTS = [
  { href: "/dashboard/leads", label: "Import leads", sub: "CSV with column mapping", icon: UploadSimple },
  { href: "/dashboard/lead-lists", label: "Build an audience", sub: "Describe it in plain English", icon: UsersThree },
  { href: "/dashboard/leads/drafts", label: "Review email drafts", sub: "Approve before anything sends", icon: PencilSimpleLine },
  { href: "/dashboard/deliverability", label: "Connect a mailbox", sub: "Google or Microsoft, no DNS", icon: EnvelopeSimple },
];

export default function CommandCenter({ firstName, data, activities, setup }: { firstName: string | null; data: InsightBoardData; activities: ActivityRow[]; setup?: ReactNode }) {
  const c = data.campaignMetrics;
  const active = pick(c, "Active Campaigns");
  const sent = pick(c, "Total Sent");
  const reply = pick(c, "Reply Rate");
  const scheduled = pick(c, "Sends Scheduled");
  const sentTrend = data.outreachOverTime.series[0]?.values;

  const leads = data.leadMetrics;
  const total = num(pick(leads, "Total Leads")?.value);
  const reached = num(pick(leads, "Leads Reached")?.value);
  const reachedPct = total ? Math.round((reached / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome back{firstName ? `, ${firstName}` : ""}</h2>
          <p className="mt-1 text-[13px] text-neutral-500">Here&apos;s what&apos;s moving across your outbound.</p>
        </div>
        <Link
          href="/dashboard/gennie"
          className="group relative flex w-full items-center gap-3 rounded-xl bg-white p-1.5 pr-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-200 transition-all hover:ring-violet-300 md:w-[420px]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_8px_-2px_rgba(124,58,237,0.6)]">
            <Sparkle className="h-4 w-4" weight="fill" />
          </span>
          <span className="flex-1 truncate text-[13px] text-neutral-400 group-hover:text-neutral-500">Ask Gennie to rank or research your leads…</span>
          <Kbd>↵</Kbd>
        </Link>
      </div>

      {setup}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active campaigns" value={active?.value ?? "0"} sub={active?.sub} icon={Megaphone} tone="indigo" />
        <Stat label="Messages sent" value={sent?.value ?? "0"} sub={sent?.sub} icon={PaperPlaneTilt} tone="sky" trend={sentTrend} />
        <Stat label="Reply rate" value={reply?.value ?? "0%"} sub={reply?.sub} icon={ChatCircleDots} tone="emerald" />
        <Stat label="Scheduled" value={scheduled?.value ?? "0"} sub={scheduled?.sub} icon={Clock} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <OutreachCard sent={data.outreachOverTime} status={data.dailyStatusBreakdown} channel={data.channelBreakdown} />

        <Card>
          <CardHeader
            title="Lead universe"
            description={`${reachedPct}% reached by a sequence`}
            action={
              <Link href="/dashboard/leads" className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
                View <ArrowUpRight className="h-3 w-3" weight="bold" />
              </Link>
            }
          />
          <div className="px-4 pb-2 pt-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${reachedPct}%` }} />
            </div>
          </div>
          <ul className="divide-y divide-neutral-100 px-4">
            {leads.map((m) => (
              <li key={m.label} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-neutral-700">{m.label}</p>
                  <p className="truncate text-[11px] text-neutral-400">{m.sub}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-900">{m.value}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            action={
              <Link href="/dashboard/activities" className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
                View all <ArrowUpRight className="h-3 w-3" weight="bold" />
              </Link>
            }
          />
          {activities.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-neutral-400">Nothing yet — imports, launches and approvals show up here.</p>
          ) : (
            <ul className="px-4 py-2">
              {activities.slice(0, 6).map((a, i, arr) => {
                const { icon: I, cls } = activityIcon(a.type);
                return (
                  <li key={a.id} className="relative flex gap-3 py-2.5">
                    {i < arr.length - 1 && <span className="absolute left-[13px] top-9 h-[calc(100%-24px)] w-px bg-neutral-100" />}
                    <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${cls}`}>
                      <I className="h-3.5 w-3.5" weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[13px] text-neutral-800">{a.summary}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-400">
                        {a.actorName ?? "System"} · {ago(a.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Shortcuts" />
          <ul className="p-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-neutral-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 group-hover:text-indigo-600">
                    <s.icon className="h-4 w-4" weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-neutral-900">{s.label}</span>
                    <span className="block truncate text-[11px] text-neutral-400">{s.sub}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" weight="bold" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
