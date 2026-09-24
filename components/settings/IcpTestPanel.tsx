"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { testIcpAgainstSample, type IcpTestResult } from "@/lib/actions/intelligence";
import type { Icp } from "@/lib/domain/workspace/icp";

const inputCls =
  "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";
const DOT = { met: "bg-emerald-500", partial: "bg-amber-400", not_met: "bg-rose-500", unknown: "bg-neutral-300" } as const;

/** Scores a made-up lead against the (possibly UNSAVED) ICP so the effect of a change is visible before saving. */
export default function IcpTestPanel({ getIcp }: { getIcp: () => Icp | string }) {
  const [sample, setSample] = useState({ industry: "B2B SaaS", country: "India", employees: "120", title: "VP Sales", keywords: "" });
  const [result, setResult] = useState<IcpTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof sample) => (e: React.ChangeEvent<HTMLInputElement>) => setSample({ ...sample, [k]: e.target.value });

  function run() {
    setError(null);
    const icp = getIcp();
    if (typeof icp === "string") return setError(icp);
    start(async () => {
      const res = await testIcpAgainstSample({
        icp,
        sample: {
          industry: sample.industry || null, country: sample.country || null,
          employeeCount: sample.employees.trim() === "" ? null : Number(sample.employees),
          title: sample.title || null, keywordsFound: sample.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      if (!res.ok) { setResult(null); return setError(res.error.message); }
      setResult(res.data);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-neutral-900">Test against a sample lead</h2>
        <p className="text-sm text-neutral-500">Nothing is saved or researched — this scores the values below with the ICP as currently edited.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="Sample industry" placeholder="Industry" value={sample.industry} onChange={set("industry")} className={inputCls} />
        <input aria-label="Sample location" placeholder="Location" value={sample.country} onChange={set("country")} className={inputCls} />
        <input aria-label="Sample employees" placeholder="Employees" inputMode="numeric" value={sample.employees} onChange={set("employees")} className={inputCls} />
        <input aria-label="Sample job title" placeholder="Job title" value={sample.title} onChange={set("title")} className={inputCls} />
        <input aria-label="Sample keywords found" placeholder="Keywords found (comma separated)" value={sample.keywords} onChange={set("keywords")} className={`${inputCls} col-span-2`} />
      </div>
      <button type="button" onClick={run} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white text-sm font-medium text-neutral-700 px-4 py-2 hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50">
        {pending && <Loader2 className="w-4 h-4 animate-spin" />} Score sample
      </button>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {result && (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4" role="status">
          <p className="text-sm text-neutral-900">
            <span className="text-2xl font-bold tabular-nums">{result.icpScore}</span> / 100
            <span className={result.qualified ? "ml-3 text-emerald-600 font-medium" : "ml-3 text-neutral-500"}>{result.qualified ? "Qualified" : "Below threshold"}</span>
            <span className="ml-3 text-xs text-neutral-500">confidence {Math.round(result.confidence * 100)}%</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {result.whyFit.map((w) => (
              <li key={w.criterion} className="flex items-center gap-2 text-neutral-700">
                <span className={`w-2 h-2 rounded-full ${DOT[w.status as keyof typeof DOT] ?? DOT.unknown}`} /> {w.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
