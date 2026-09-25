import Link from "next/link";
import { ArrowDown, Check, Minus, Sparkle } from "@phosphor-icons/react/ssr";
import { CompanyMark } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import PageShell from "./pages-kit/PageShell";
import SectionHeading, { Eyebrow, HeroBackdrop } from "./pages-kit/SectionHeading";
import EarlyAccessButton from "./pages-kit/EarlyAccessButton";
import CompareTable from "./pages-kit/CompareTable";
import CtaBand from "./pages-kit/CtaBand";
import { COMPARE_PAGES, type CompareBullet, type CompareTableRow } from "./pages-kit/compare-core";

export type { CompareBullet, CompareTableRow } from "./pages-kit/compare-core";

export interface CompareTemplateProps {
  competitorName: string;
  competitorShort: string;
  tagline: string;
  theirLabel: string;
  theirBullets: CompareBullet[];
  ourLabel: string;
  ourBullets: CompareBullet[];
  tableRows: CompareTableRow[];
  whyHeading: string;
  whyParagraphs: string[];
}

function LeadGennieTile({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
        size === "lg" ? "h-10 w-10 rounded-xl" : "h-7 w-7 rounded-lg",
      )}
    >
      <Sparkle className={size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5"} weight="fill" />
    </span>
  );
}

function BulletCard({ label, bullets, ours, competitor }: { label: string; bullets: CompareBullet[]; ours?: boolean; competitor: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 md:p-7",
        ours
          ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-12px_rgba(79,70,229,0.18)] ring-1 ring-indigo-200/80"
          : "bg-neutral-50/70 ring-1 ring-neutral-200/80",
      )}
    >
      <div className="flex items-center gap-2.5">
        {ours ? <LeadGennieTile /> : <CompanyMark name={competitor} size="md" className="rounded-lg" />}
        <p className={cn("text-[13px] font-semibold", ours ? "text-neutral-900" : "text-neutral-600")}>{label}</p>
      </div>
      <ul className="mt-5 space-y-3.5">
        {bullets.map((b) => (
          <li key={b.title} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                ours ? "bg-emerald-50 text-emerald-600 ring-emerald-200/70" : "bg-white text-neutral-400 ring-neutral-200",
              )}
            >
              {ours ? <Check className="h-3 w-3" weight="bold" /> : <Minus className="h-3 w-3" weight="bold" />}
            </span>
            <p className="text-[15px] leading-relaxed text-neutral-600">
              <span className={cn("font-medium", ours ? "text-neutral-950" : "text-neutral-800")}>{b.title}:</span> {b.desc}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hero side card: the first comparison row, framed as the headline difference. */
function AtAGlance({ competitor, row }: { competitor: string; row: CompareTableRow }) {
  return (
    <div className="hidden rounded-2xl border border-neutral-200/80 bg-white/90 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_-20px_rgba(0,0,0,0.18)] backdrop-blur lg:block">
      <div className="flex items-center justify-between px-3 pb-2.5 pt-2">
        <Eyebrow>At a glance</Eyebrow>
        <span className="text-[11px] text-neutral-400">{row.feature}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-3 ring-1 ring-inset ring-neutral-200/70">
          <CompanyMark name={competitor} size="md" className="rounded-lg" />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{competitor}</p>
            <p className="text-sm font-medium text-neutral-700">{row.their}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50/60 px-3 py-3 ring-1 ring-inset ring-indigo-200/70">
          <LeadGennieTile />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">LeadGennie</p>
            <p className="text-sm font-semibold text-neutral-950">{row.ours}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompareTemplate({
  competitorName,
  competitorShort,
  tagline,
  theirLabel,
  theirBullets,
  ourLabel,
  ourBullets,
  tableRows,
  whyHeading,
  whyParagraphs,
}: CompareTemplateProps) {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative isolate px-4 pb-14 pt-16 md:px-6 md:pb-20 md:pt-24">
        <HeroBackdrop />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <LeadGennieTile size="lg" />
              <span className="text-xs font-medium text-neutral-400">vs</span>
              <CompanyMark name={competitorShort} size="lg" className="rounded-xl" />
            </div>
            <Eyebrow className="mt-7">LeadGennie vs {competitorName}</Eyebrow>
            <h1 className="mt-3 max-w-3xl text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-neutral-950 sm:text-5xl md:text-[60px]">
              LeadGennie vs {competitorName}
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-neutral-600">{tagline}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <EarlyAccessButton />
              <a href="#comparison" className={buttonClasses({ variant: "secondary", className: "h-10 gap-2 px-4 text-sm" })}>
                See the comparison
                <ArrowDown className="h-3.5 w-3.5" weight="bold" />
              </a>
            </div>

            <nav aria-label="Other comparisons" className="mt-12 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-neutral-500">Compare with</span>
              {COMPARE_PAGES.map((p) => {
                const active = p.label === competitorName || p.label === competitorShort;
                return (
                  <Link
                    key={p.href}
                    href={p.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium ring-1 ring-inset transition-colors",
                      active
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
                    )}
                  >
                    <CompanyMark name={p.label} size="xs" className={active ? "ring-0" : undefined} />
                    {p.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          {tableRows[0] && <AtAGlance competitor={competitorShort} row={tableRows[0]} />}
        </div>
      </section>

      {/* Positioning */}
      <section className="border-t border-neutral-200/80 bg-[#fafaf9] px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Positioning" title={`Where ${competitorShort} fits, and where LeadGennie does`} />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <BulletCard label={theirLabel} bullets={theirBullets} competitor={competitorShort} />
            <BulletCard label={ourLabel} bullets={ourBullets} competitor={competitorShort} ours />
          </div>
        </div>
      </section>

      {/* Table */}
      <section id="comparison" className="scroll-mt-24 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Side by side" title="Feature comparison" />
          <div className="mt-10">
            <CompareTable competitor={competitorShort} rows={tableRows} />
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="px-4 pb-20 md:px-6 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Why teams switch" title={whyHeading} />
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            {whyParagraphs.map((p, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:p-7">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-600 ring-1 ring-inset ring-neutral-200/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand title="Ready to automate your outbound sequences?" />
    </PageShell>
  );
}
