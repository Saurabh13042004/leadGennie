"use client";

import { useState } from "react";
import { ArrowRight, Check, Minus } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export interface CompareBullet {
  title: string;
  desc: string;
}

export interface CompareTableRow {
  feature: string;
  their: string;
  ours: string;
  oursHighlight?: boolean;
}

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
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <LandingNavbar />

      <main>
        <section className="px-5 pb-4 pt-16 md:pt-20">
          <div className="mx-auto max-w-4xl">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">
              LeadGennie vs {competitorName}
            </p>
            <h1 className="mb-5 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-neutral-900 sm:text-5xl">
              LeadGennie vs {competitorName}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-neutral-500">{tagline}</p>
          </div>
        </section>

        <section className="px-5 py-10">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">{theirLabel}</p>
              <div className="flex flex-col gap-3.5">
                {theirBullets.map((b) => (
                  <div key={b.title} className="flex items-start gap-2 text-sm">
                    <Minus className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="text-neutral-500">
                      <strong className="text-neutral-700">{b.title}:</strong> {b.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-indigo-500">{ourLabel}</p>
              <div className="flex flex-col gap-3.5">
                {ourBullets.map((b) => (
                  <div key={b.title} className="flex items-start gap-2 text-sm">
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="text-neutral-700">
                      <strong className="text-neutral-900">{b.title}:</strong> {b.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-6">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-neutral-200">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Feature</th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    {competitorShort}
                  </th>
                  <th className="p-4 text-[11px] font-bold uppercase tracking-wide text-indigo-500">LeadGennie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {tableRows.map((row) => (
                  <tr key={row.feature}>
                    <td className="p-4 font-semibold text-neutral-900">{row.feature}</td>
                    <td className="p-4 text-neutral-500">{row.their}</td>
                    <td className={`p-4 ${row.oursHighlight ? "font-medium text-indigo-600" : "text-neutral-700"}`}>
                      {row.ours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="px-5 py-10">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-4 text-2xl font-extrabold tracking-[-0.02em] text-neutral-900">{whyHeading}</h2>
            <div className="flex flex-col gap-4 text-sm leading-relaxed text-neutral-600">
              {whyParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="mx-auto max-w-4xl border-t border-neutral-200 pt-10 text-center">
            <h3 className="mb-5 text-xl font-bold text-neutral-900">Ready to automate your outbound sequences?</h3>
            <button
              onClick={() => setIsAccessOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-neutral-800"
            >
              Get Early Access
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <LandingFooter />
      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </div>
  );
}
