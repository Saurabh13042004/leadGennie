"use client";

import { useState, useTransition } from "react";
import { Flask } from "@phosphor-icons/react/ssr";
import { testIcpAgainstSample, type IcpTestResult } from "@/lib/actions/intelligence";
import type { Icp } from "@/lib/domain/workspace/icp";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { Callout, Spinner } from "./bits";

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
    <Section title="Test against a sample lead" description="Nothing is saved or researched — this scores the values here with the ICP as currently edited.">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Sample industry" placeholder="Industry" value={sample.industry} onChange={set("industry")} />
          <Input aria-label="Sample location" placeholder="Location" value={sample.country} onChange={set("country")} />
          <Input aria-label="Sample employees" placeholder="Employees" inputMode="numeric" value={sample.employees} onChange={set("employees")} />
          <Input aria-label="Sample job title" placeholder="Job title" value={sample.title} onChange={set("title")} />
          <Input aria-label="Sample keywords found" placeholder="Keywords found (comma separated)" value={sample.keywords} onChange={set("keywords")} className="col-span-2" />
        </div>
        <Button onClick={run} disabled={pending}>
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <Flask className="h-4 w-4 text-indigo-600" weight="duotone" />} Score sample
        </Button>
        {error && <Callout>{error}</Callout>}
        {result && (
          <div className="rounded-lg bg-neutral-50/80 p-4 ring-1 ring-inset ring-neutral-200/70" role="status">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="text-neutral-900">
                <span className="text-2xl font-semibold tabular-nums tracking-tight">{result.icpScore}</span>
                <span className="text-[13px] text-neutral-400"> / 100</span>
              </p>
              <Badge tone={result.qualified ? "emerald" : "neutral"} dot>{result.qualified ? "Qualified" : "Below threshold"}</Badge>
              <span className="text-xs text-neutral-500">confidence {Math.round(result.confidence * 100)}%</span>
            </div>
            <ul className="mt-3 space-y-1.5 border-t border-neutral-200/70 pt-3 text-[13px]">
              {result.whyFit.map((w) => (
                <li key={w.criterion} className="flex items-start gap-2 text-neutral-700">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT[w.status as keyof typeof DOT] ?? DOT.unknown)} /> {w.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
