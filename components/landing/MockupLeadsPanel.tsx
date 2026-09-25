import { CaretDown, CircleNotch, MagnifyingGlass, Plus, SealCheck, UploadSimple, UsersThree } from "@phosphor-icons/react/ssr";
import Avatar, { CompanyMark } from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Research = "done" | "partial" | "running" | "queued" | "none";

/** Illustrative rows for the marketing mockup only — fictional people and companies. */
const ROWS: { name: string; email: string; company: string; domain: string; icp: number | null; research: Research; stage: "Qualified" | "New"; title: string }[] = [
  { name: "Priya Nair", email: "priya@northwind.io", company: "Northwind Analytics", domain: "northwind.io", icp: 91, research: "done", stage: "Qualified", title: "Head of Growth" },
  { name: "Daniel Okafor", email: "daniel@fabrikam.dev", company: "Fabrikam Labs", domain: "fabrikam.dev", icp: 86, research: "done", stage: "Qualified", title: "VP Sales" },
  { name: "Sofia Martins", email: "sofia@contoso.cloud", company: "Contoso Cloud", domain: "contoso.cloud", icp: 78, research: "done", stage: "Qualified", title: "Head of RevOps" },
  { name: "Ethan Brooks", email: "ethan@globex.so", company: "Globex Software", domain: "globex.so", icp: 72, research: "partial", stage: "New", title: "CTO" },
  { name: "Hannah Weiss", email: "hannah@initech.app", company: "Initech Systems", domain: "initech.app", icp: null, research: "running", stage: "New", title: "Marketing Lead" },
  { name: "Lucas Moreau", email: "lucas@tidewater.io", company: "Tidewater Labs", domain: "tidewater.io", icp: null, research: "queued", stage: "New", title: "Founder & CEO" },
  { name: "Aisha Rahman", email: "aisha@brightlane.co", company: "Brightlane", domain: "brightlane.co", icp: null, research: "none", stage: "New", title: "Director of Sales" },
  { name: "Tom Becker", email: "tom@larkspur.ai", company: "Larkspur AI", domain: "larkspur.ai", icp: null, research: "none", stage: "New", title: "VP Marketing" },
];

const RESEARCH: Record<Research, { label: string; cls: string }> = {
  done: { label: "Researched", cls: "text-neutral-700" },
  partial: { label: "Partial", cls: "text-amber-600" },
  running: { label: "Researching…", cls: "text-indigo-600" },
  queued: { label: "Queued", cls: "text-indigo-600" },
  none: { label: "Not researched", cls: "text-neutral-400" },
};

const DOT: Record<Research, string> = { done: "bg-emerald-500", partial: "bg-amber-500", running: "", queued: "", none: "bg-neutral-300" };

function IcpCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-neutral-300">—</span>;
  const high = score >= 80;
  return (
    <span className="flex items-center gap-2">
      <span className={cn("w-5 text-[13px] font-semibold tabular-nums", high ? "text-emerald-600" : "text-amber-600")}>{score}</span>
      <span className="h-1.5 w-11 overflow-hidden rounded-full bg-neutral-100">
        <span className={cn("block h-full rounded-full", high ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${score}%` }} />
      </span>
      {score >= 70 && <SealCheck className="h-3.5 w-3.5 text-emerald-500" weight="fill" />}
    </span>
  );
}

function ResearchCell({ state }: { state: Research }) {
  const r = RESEARCH[state];
  return (
    <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", r.cls)}>
      {state === "running" || state === "queued" ? (
        <CircleNotch className={cn("h-3 w-3", state === "running" && "animate-spin")} weight="bold" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[state])} />
      )}
      {r.label}
    </span>
  );
}

const STAGE_TONE: Record<string, Tone> = { Qualified: "emerald", New: "neutral" };

function FilterPill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("flex h-8 items-center gap-6 rounded-lg bg-white px-2.5 text-[13px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>
      {label}
      <CaretDown className="h-3 w-3 text-neutral-400" weight="bold" />
    </span>
  );
}

/** Miniature of the Leads page (header, tabs, filters, dense table). Decorative. */
export default function MockupLeadsPanel() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 ring-1 ring-inset ring-neutral-200/80">
            <UsersThree className="h-[18px] w-[18px]" weight="duotone" />
          </span>
          <span className="text-[15px] font-semibold text-neutral-900">Leads</span>
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500">32</span>
          <span className="hidden truncate text-[13px] text-neutral-400 xl:inline">· Import, research and segment your lead universe</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={buttonClasses({ variant: "secondary", size: "sm", className: "hidden sm:inline-flex" })}>
            <Plus className="h-3.5 w-3.5" weight="bold" />
            Add lead
          </span>
          <span className={buttonClasses({ variant: "primary", size: "sm" })}>
            <UploadSimple className="h-3.5 w-3.5" weight="bold" />
            Import leads
          </span>
        </div>
      </div>

      <div className="mt-2 flex gap-5 border-b border-neutral-200/80 px-4 text-[13px] font-medium md:px-5">
        <span className="border-b-2 border-neutral-900 pb-2.5 pt-1 text-neutral-900">All leads</span>
        <span className="pb-2.5 pt-1 text-neutral-500">Audiences</span>
        <span className="pb-2.5 pt-1 text-neutral-500">Inbound</span>
        <span className="hidden pb-2.5 pt-1 text-neutral-500 sm:inline">Email drafts</span>
      </div>

      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 md:px-5">
        <span className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] text-neutral-400 ring-1 ring-inset ring-neutral-200 lg:max-w-[260px]">
          <MagnifyingGlass className="h-3.5 w-3.5 shrink-0" weight="bold" />
          <span className="truncate">Search name, email, company…</span>
        </span>
        <FilterPill label="Stage" className="hidden sm:flex" />
        <FilterPill label="Research" className="hidden md:flex" />
        <FilterPill label="ICP score" className="hidden lg:flex" />
      </div>

      <table className="w-full table-auto text-left text-[13px]">
        <thead>
          <tr className="border-b border-neutral-100 text-[12px] text-neutral-500">
            <th className="hidden w-10 py-2 pl-5 font-normal md:table-cell">
              <span className="block h-4 w-4 rounded-[5px] ring-1 ring-inset ring-neutral-300" />
            </th>
            <th className="py-2 pl-4 font-normal md:pl-1">Lead</th>
            <th className="hidden py-2 font-normal sm:table-cell">Company</th>
            <th className="py-2 pr-4 font-normal md:pr-0">ICP fit</th>
            <th className="hidden py-2 font-normal lg:table-cell">Research</th>
            <th className="hidden py-2 font-normal lg:table-cell">Stage</th>
            <th className="hidden py-2 pr-5 font-normal xl:table-cell">Job title</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.email} className="border-b border-neutral-100 last:border-0">
              <td className="hidden py-2.5 pl-5 md:table-cell">
                <span className="block h-4 w-4 rounded-[5px] ring-1 ring-inset ring-neutral-300" />
              </td>
              <td className="py-2.5 pl-4 md:pl-1">
                <span className="flex items-center gap-2.5">
                  <Avatar name={r.name} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900">{r.name}</span>
                    <span className="block truncate text-[12px] text-neutral-500">{r.email}</span>
                  </span>
                </span>
              </td>
              <td className="hidden py-2.5 sm:table-cell">
                <span className="flex items-center gap-2.5">
                  <CompanyMark name={r.company} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-neutral-800">{r.company}</span>
                    <span className="block truncate text-[11px] text-neutral-400">{r.domain}</span>
                  </span>
                </span>
              </td>
              <td className="py-2.5 pr-4 md:pr-0">
                <IcpCell score={r.icp} />
              </td>
              <td className="hidden py-2.5 lg:table-cell">
                <ResearchCell state={r.research} />
              </td>
              <td className="hidden py-2.5 lg:table-cell">
                <Badge tone={STAGE_TONE[r.stage]} dot>
                  {r.stage}
                </Badge>
              </td>
              <td className="hidden py-2.5 pr-5 text-neutral-700 xl:table-cell">{r.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
