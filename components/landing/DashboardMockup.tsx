import { BarChart3, Bot, Inbox, LayoutDashboard, Plug, Plus, Share2, Users } from "lucide-react";

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Leads" },
  { icon: Share2, label: "Campaigns" },
  { icon: Inbox, label: "Inbox" },
  { icon: Share2, label: "LinkedIn" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Bot, label: "AI Agents" },
  { icon: Plug, label: "Integrations" },
];

const STATS = [
  { label: "Leads", note: "Live workspace data" },
  { label: "Enriched", note: "Based on current filters" },
  { label: "Replies", note: "Across active channels" },
  { label: "Meetings", note: "Tracked in workflow" },
];

const AGENT_ACTIVITY = [
  { title: "Lead filtering", desc: "Applying prompt-defined ICP criteria" },
  { title: "Enrichment", desc: "Reviewing available lead data" },
  { title: "Personalization", desc: "Creating context-aware outreach" },
  { title: "Sequence monitoring", desc: "Watching for replies and signals" },
];

const RECENT_ACTIVITY = [
  { title: "Intent signal found", desc: "Company hiring activity detected", status: "Review", live: true },
  { title: "LinkedIn follow-up ready", desc: "Sequence continues after acceptance", status: "Queued", live: false },
  { title: "Email reply detected", desc: "Sequence can stop or branch", status: "Reply", live: true },
];

export default function DashboardMockup() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-10 -z-10 rounded-[32px] bg-gradient-to-br from-indigo-100 via-indigo-50 to-transparent blur-2xl" />

      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(20,25,30,0.12)]">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded border border-neutral-200 bg-white">
              <svg className="h-3 w-3 text-neutral-900" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-neutral-800">LeadGennie</span>
            <span className="text-[10px] text-neutral-400">/ Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Beta
            </span>
            <span className="text-[9px] text-neutral-400">Today</span>
          </div>
        </div>

        <div className="grid grid-cols-[126px_1fr]">
          <div className="border-r border-neutral-200 bg-neutral-50 p-2.5">
            {SIDEBAR_ITEMS.map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className={`mb-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${
                  item.active ? "border border-neutral-200 bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                }`}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="p-3.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-[13px] font-bold tracking-tight text-neutral-900">Outbound overview</h4>
                <p className="text-[9px] text-neutral-400">Your workflows, leads and activity in one place.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[9px] font-semibold text-neutral-600">
                <Plus className="h-2.5 w-2.5" />
                New workflow
              </div>
            </div>

            <div className="mb-2.5 grid grid-cols-4 gap-1.5">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-neutral-200 bg-white p-2">
                  <div className="text-[8px] text-neutral-400">{stat.label}</div>
                  <div className="mt-0.5 text-[13px] font-extrabold tracking-tight text-neutral-300">—</div>
                  <div className="mt-0.5 text-[7px] leading-tight text-neutral-400">{stat.note}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-200 px-2.5 py-1.5">
                  <span className="text-[9px] font-bold text-neutral-700">Campaign activity</span>
                  <span className="text-[8px] text-neutral-400">Example view</span>
                </div>
                <div className="p-2">
                  <svg viewBox="0 0 200 70" className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
                    <polyline
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      points="0,58 20,52 38,54 55,40 70,45 88,30 105,34 122,24 140,27 158,18 176,22 200,10"
                    />
                    <polyline
                      fill="none"
                      stroke="#d4d4d8"
                      strokeWidth="1.2"
                      points="0,64 22,60 44,55 55,50 65,50 80,46 95,40 112,42 130,35 145,37 200,30"
                    />
                  </svg>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-200 px-2.5 py-1.5">
                  <span className="text-[9px] font-bold text-neutral-700">AI agent activity</span>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-2">
                  {AGENT_ACTIVITY.map((a) => (
                    <div key={a.title} className="flex items-start gap-1.5">
                      <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[6px] font-bold text-indigo-600">
                        AI
                      </div>
                      <div className="min-w-0">
                        <div className="text-[8px] font-semibold text-neutral-800">{a.title}</div>
                        <div className="truncate text-[7px] text-neutral-400">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-200 px-2.5 py-1.5">
                <span className="text-[9px] font-bold text-neutral-700">Recent activity</span>
                <span className="text-[8px] text-neutral-400">Lead-level history</span>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {RECENT_ACTIVITY.map((a) => (
                  <div key={a.title} className="flex items-center gap-1.5">
                    <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[6px] font-bold text-neutral-500">
                      •
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[8px] font-semibold text-neutral-800">{a.title}</div>
                      <div className="truncate text-[7px] text-neutral-400">{a.desc}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${
                        a.live
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -right-5 max-w-[220px] rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_18px_45px_rgba(20,25,30,0.16)]">
        <p className="mb-1 text-[11px] font-bold text-neutral-900">Built for high-volume outreach</p>
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Use prompts, signals and workflows to make each touch more relevant.
        </p>
      </div>
    </div>
  );
}
