import type { ReactNode } from "react";
import { CaretDown, ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import PageShell from "@/components/landing/pages-kit/PageShell";
import { Eyebrow, HeroBackdrop } from "@/components/landing/pages-kit/SectionHeading";
import LegalToc, { type TocItem } from "./LegalToc";

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Docs-style layout for legal/trust pages: title block, sticky table of contents (desktop), readable prose. */
export default function LegalPage({
  eyebrow,
  title,
  meta,
  updated,
  intro,
  sections,
  numbered = true,
}: {
  eyebrow: string;
  title: string;
  /** Sub-title line under the heading (used when a page has no "Last updated" date). */
  meta?: string;
  updated?: string;
  intro: ReactNode;
  sections: LegalSection[];
  numbered?: boolean;
}) {
  const toc: TocItem[] = sections.map((s, i) => ({ id: s.id, title: s.title, num: numbered ? String(i + 1).padStart(2, "0") : undefined }));

  return (
    <PageShell>
      <header className="relative isolate border-b border-neutral-200/80 px-4 pb-12 pt-16 md:px-6 md:pb-16 md:pt-24">
        <HeroBackdrop />
        <div className="mx-auto max-w-6xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-neutral-950 md:text-[52px]">{title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
            {updated && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-white px-2.5 ring-1 ring-inset ring-neutral-200/80">
                <ClockCounterClockwise className="h-3.5 w-3.5 text-neutral-400" weight="bold" />
                Last updated: {updated}
              </span>
            )}
            {meta && <span>{meta}</span>}
          </div>
        </div>
      </header>

      <div className="px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:order-none">
            <div className="hidden lg:sticky lg:top-24 lg:block">
              <LegalToc items={toc} />
            </div>
            <details className="group rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium text-neutral-800 [&::-webkit-details-marker]:hidden">
                On this page
                <CaretDown className="h-3.5 w-3.5 text-neutral-400 transition-transform group-open:rotate-180" weight="bold" />
              </summary>
              <ol className="border-t border-neutral-100 px-4 py-2">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="flex gap-2 py-1.5 text-[13px] text-neutral-600 hover:text-neutral-900">
                      {t.num && <span className="w-4 shrink-0 tabular-nums text-neutral-400">{t.num}</span>}
                      {t.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </aside>

          <article className="min-w-0 max-w-[720px]">
            <div className="space-y-4 text-[17px] leading-relaxed text-neutral-700">{intro}</div>
            <div className="mt-10 divide-y divide-neutral-200/80 border-t border-neutral-200/80">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-24 py-10 first:pt-10">
                  <h2 className="flex items-baseline gap-3 text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">
                    {numbered && <span className="text-[13px] font-medium tabular-nums text-neutral-400">{toc[i].num}</span>}
                    {s.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-neutral-600">{s.body}</div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </PageShell>
  );
}
