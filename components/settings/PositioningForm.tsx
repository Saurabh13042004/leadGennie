"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { saveWorkspaceProfile, type WorkspaceProfileView } from "@/lib/actions/workspace-profile";
import { parseList, type Icp } from "@/lib/domain/workspace/icp";
import IcpScoringSection, { type ScoringDraft } from "./IcpScoringSection";
import IcpTestPanel from "./IcpTestPanel";

const inputCls =
  "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60";
const join = (l: string[]) => l.join(", ");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500 mt-1">{hint}</span>}
    </label>
  );
}

export default function PositioningForm({ initial, canEdit }: { initial: WorkspaceProfileView; canEdit: boolean }) {
  const [positioning, setPositioning] = useState(initial.positioning);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [industries, setIndustries] = useState(join(initial.icp.industries));
  const [geographies, setGeographies] = useState(join(initial.icp.geographies));
  const [titles, setTitles] = useState(join(initial.icp.titles));
  const [minEmp, setMinEmp] = useState(initial.icp.employee_range?.min?.toString() ?? "");
  const [maxEmp, setMaxEmp] = useState(initial.icp.employee_range?.max?.toString() ?? "");
  const [exInd, setExInd] = useState(join(initial.icp.exclusions.industries));
  const [exDom, setExDom] = useState(join(initial.icp.exclusions.domains));
  const [exTitles, setExTitles] = useState(join(initial.icp.exclusions.titles));
  const s = initial.icp.scoring;
  const [scoring, setScoring] = useState<ScoringDraft>({
    minScore: String(s.min_score_to_qualify),
    weights: {
      industry: String(s.weights.industry), employee_range: String(s.weights.employee_range),
      geography: String(s.weights.geography), title: String(s.weights.title),
    },
    keywords: s.keywords.map((k) => k.keyword).join(", "),
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  /** The ICP as currently edited (saved or not), or a message explaining what's wrong with it. */
  function buildIcp(): Icp | string {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const min = num(minEmp);
    const max = num(maxEmp);
    if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max))) return "Employee range must be whole numbers.";
    const w = Object.fromEntries(Object.entries(scoring.weights).map(([k, v]) => [k, Number(v)])) as Icp["scoring"]["weights"];
    const threshold = Number(scoring.minScore);
    if (Object.values(w).some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return "Weights must be numbers between 0 and 100.";
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) return "The qualification threshold must be a whole number from 0 to 100.";
    const previous = new Map(initial.icp.scoring.keywords.map((k) => [k.keyword.toLowerCase(), k.weight]));
    return {
      version: 1,
      industries: parseList(industries),
      geographies: parseList(geographies),
      titles: parseList(titles),
      employee_range: min === null && max === null ? null : { min, max },
      exclusions: { industries: parseList(exInd), domains: parseList(exDom), titles: parseList(exTitles) },
      scoring: {
        min_score_to_qualify: threshold,
        weights: w,
        keywords: parseList(scoring.keywords).map((keyword) => ({ keyword, weight: previous.get(keyword.toLowerCase()) ?? 10 })),
      },
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const icp = buildIcp();
    if (typeof icp === "string") {
      setMessage({ ok: false, text: icp });
      return;
    }
    start(async () => {
      const res = await saveWorkspaceProfile({ positioning, companyName, icp });
      setMessage(
        res.ok
          ? { ok: true, text: res.data.rescoring ? `Saved. Re-scoring ${res.data.rescoring} researched lead${res.data.rescoring === 1 ? "" : "s"} in the background.` : "Saved." }
          : { ok: false, text: res.error.message },
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">What you sell</h2>
          <p className="text-sm text-neutral-500">Used as the starting point for every message. Be specific about the problem you solve.</p>
        </div>
        <Field label="Company name">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} maxLength={200} placeholder="Acme Inc." className={inputCls} />
        </Field>
        <Field label="Positioning" hint="e.g. “We help B2B SaaS founders book 10 qualified demos a month without hiring an SDR.”">
          <textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} disabled={!canEdit} maxLength={2000} rows={4} className={inputCls} />
        </Field>
      </section>

      <section id="icp" className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4 scroll-mt-20">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Ideal customer profile</h2>
          <p className="text-sm text-neutral-500">Who you want to reach. Separate multiple values with commas. Leave anything blank to not restrict on it.</p>
        </div>
        <Field label="Industries"><input value={industries} onChange={(e) => setIndustries(e.target.value)} disabled={!canEdit} placeholder="B2B SaaS, Fintech" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min employees"><input inputMode="numeric" value={minEmp} onChange={(e) => setMinEmp(e.target.value)} disabled={!canEdit} placeholder="50" className={inputCls} /></Field>
          <Field label="Max employees"><input inputMode="numeric" value={maxEmp} onChange={(e) => setMaxEmp(e.target.value)} disabled={!canEdit} placeholder="500" className={inputCls} /></Field>
        </div>
        <Field label="Geographies"><input value={geographies} onChange={(e) => setGeographies(e.target.value)} disabled={!canEdit} placeholder="United States, India, EMEA" className={inputCls} /></Field>
        <Field label="Target titles"><input value={titles} onChange={(e) => setTitles(e.target.value)} disabled={!canEdit} placeholder="VP Sales, Head of Growth, Founder" className={inputCls} /></Field>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-4">
          <p className="text-sm font-semibold text-neutral-900">Exclusions <span className="font-normal text-neutral-500">— never target these</span></p>
          <Field label="Industries"><input value={exInd} onChange={(e) => setExInd(e.target.value)} disabled={!canEdit} className={inputCls} /></Field>
          <Field label="Company domains" hint="e.g. competitor.com, existing-customer.com"><input value={exDom} onChange={(e) => setExDom(e.target.value)} disabled={!canEdit} className={inputCls} /></Field>
          <Field label="Titles"><input value={exTitles} onChange={(e) => setExTitles(e.target.value)} disabled={!canEdit} placeholder="Intern, Student" className={inputCls} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <IcpScoringSection value={scoring} onChange={setScoring} canEdit={canEdit} />
      </section>

      <IcpTestPanel getIcp={buildIcp} />

      {canEdit ? (
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
          {message && (
            <span role="status" className={message.ok ? "inline-flex items-center gap-1.5 text-sm text-emerald-600" : "text-sm text-rose-600"}>
              {message.ok && <CheckCircle2 className="w-4 h-4" />}{message.text}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">Only workspace owners and admins can edit this.</p>
      )}
    </form>
  );
}
