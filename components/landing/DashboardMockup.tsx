import { BarChart3, Calendar, Home, Inbox, Search, Send, Users } from "lucide-react";

const SIDEBAR_ITEMS = [
  { icon: Home, label: "Home" },
  { icon: Users, label: "Prospects", active: true },
  { icon: Send, label: "Sequences" },
  { icon: Inbox, label: "Inbox", badge: "12" },
  { icon: Calendar, label: "Meetings" },
  { icon: BarChart3, label: "Analytics" },
];

const TAG_STYLES: Record<string, string> = {
  "High Intent": "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  Funding: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  Hiring: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  Expansion: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
};

const PROSPECTS = [
  { name: "Ariana Cole", title: "Head of Growth", company: "Fernbridge", tag: "High Intent" },
  { name: "Devon Park", title: "VP Sales", company: "Nova Robotics", tag: "Funding" },
  { name: "Priya Nathan", title: "Co-founder", company: "Solace Analytics", tag: "Hiring" },
  { name: "Marcus Webb", title: "Marketing Lead", company: "Brightline", tag: "High Intent" },
  { name: "Lena Ortiz", title: "CTO", company: "Anchorpoint", tag: "Expansion" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

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
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-300" />
            <span className="h-2 w-2 rounded-full bg-neutral-300" />
            <span className="h-2 w-2 rounded-full bg-neutral-300" />
          </div>
        </div>

        <div className="grid grid-cols-[132px_1fr]">
          <div className="border-r border-neutral-200 bg-neutral-50 p-3">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item.label}
                className={`mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                  item.active
                    ? "border border-neutral-200 bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto rounded-full bg-neutral-900 px-1.5 text-[9px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-400">
                <Search className="h-3 w-3" />
                Search prospects, companies...
              </div>
              <div className="rounded-md bg-neutral-900 px-2.5 py-1.5 text-[10px] font-semibold text-white">
                + Add prospects
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold tracking-tight text-neutral-900">Prospects</h4>
              <div className="flex gap-1 text-[9px] font-medium text-neutral-400">
                {["All", "High intent", "Replied"].map((tab, i) => (
                  <span key={tab} className={i === 0 ? "font-semibold text-neutral-900" : ""}>
                    {tab}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {PROSPECTS.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded-lg border border-neutral-100 px-2 py-1.5"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[8px] font-bold text-neutral-600">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold text-neutral-800">{p.name}</div>
                    <div className="truncate text-[9px] text-neutral-400">
                      {p.title} · {p.company}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${TAG_STYLES[p.tag]}`}>
                    {p.tag}
                  </span>
                  <span className="hidden shrink-0 rounded-md border border-neutral-200 px-1.5 py-1 text-[8px] font-medium text-neutral-500 sm:inline-block">
                    Start outreach
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -right-6 -top-8 w-64 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-[0_18px_45px_rgba(20,25,30,0.16)] sm:-right-10">
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-neutral-800">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          AI is writing your outreach...
        </div>
        <div className="mb-3 flex flex-col gap-1.5">
          {[
            { label: "Researching company", done: true },
            { label: "Finding the right angle", done: true },
            { label: "Generating personalized message", done: false },
          ].map((step) => (
            <div key={step.label} className="flex items-center gap-1.5 text-[9px] text-neutral-500">
              <span
                className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[7px] ${
                  step.done ? "bg-emerald-500 text-white" : "animate-pulse bg-neutral-200 text-neutral-400"
                }`}
              >
                {step.done ? "✓" : "•"}
              </span>
              {step.label}
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5">
          <p className="text-[9px] leading-relaxed text-neutral-600">
            Hi Devon, saw Nova Robotics just closed a new funding round — exciting time to scale outbound...
          </p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200">
            Personalized
          </span>
        </div>
      </div>
    </div>
  );
}
