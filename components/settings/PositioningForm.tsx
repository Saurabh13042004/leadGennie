"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { saveWorkspaceProfile, type WorkspaceProfileView } from "@/lib/actions/workspace-profile";
import { parseList, type Icp } from "@/lib/domain/workspace/icp";

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60";
const join = (l: string[]) => l.join(", ");

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-neutral-300 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-600 mt-1">{hint}</span>}
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
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const min = num(minEmp);
    const max = num(maxEmp);
    if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max))) {
      setMessage({ ok: false, text: "Employee range must be whole numbers." });
      return;
    }
    const icp: Icp = {
      version: 1,
      industries: parseList(industries),
      geographies: parseList(geographies),
      titles: parseList(titles),
      employee_range: min === null && max === null ? null : { min, max },
      exclusions: { industries: parseList(exInd), domains: parseList(exDom), titles: parseList(exTitles) },
    };
    start(async () => {
      const res = await saveWorkspaceProfile({ positioning, companyName, icp });
      setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error.message });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-white font-semibold">What you sell</h2>
          <p className="text-sm text-neutral-500">Used as the starting point for every message. Be specific about the problem you solve.</p>
        </div>
        <Field label="Company name">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} maxLength={200} placeholder="Acme Inc." className={inputCls} />
        </Field>
        <Field label="Positioning" hint="e.g. “We help B2B SaaS founders book 10 qualified demos a month without hiring an SDR.”">
          <textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} disabled={!canEdit} maxLength={2000} rows={4} className={inputCls} />
        </Field>
      </section>

      <section id="icp" className="space-y-4 scroll-mt-20">
        <div>
          <h2 className="text-white font-semibold">Ideal customer profile</h2>
          <p className="text-sm text-neutral-500">Who you want to reach. Separate multiple values with commas. Leave anything blank to not restrict on it.</p>
        </div>
        <Field label="Industries"><input value={industries} onChange={(e) => setIndustries(e.target.value)} disabled={!canEdit} placeholder="B2B SaaS, Fintech" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min employees"><input inputMode="numeric" value={minEmp} onChange={(e) => setMinEmp(e.target.value)} disabled={!canEdit} placeholder="50" className={inputCls} /></Field>
          <Field label="Max employees"><input inputMode="numeric" value={maxEmp} onChange={(e) => setMaxEmp(e.target.value)} disabled={!canEdit} placeholder="500" className={inputCls} /></Field>
        </div>
        <Field label="Geographies"><input value={geographies} onChange={(e) => setGeographies(e.target.value)} disabled={!canEdit} placeholder="United States, India, EMEA" className={inputCls} /></Field>
        <Field label="Target titles"><input value={titles} onChange={(e) => setTitles(e.target.value)} disabled={!canEdit} placeholder="VP Sales, Head of Growth, Founder" className={inputCls} /></Field>

        <div className="rounded-lg border border-white/10 p-4 space-y-4">
          <p className="text-sm text-white">Exclusions <span className="text-neutral-600">— never target these</span></p>
          <Field label="Industries"><input value={exInd} onChange={(e) => setExInd(e.target.value)} disabled={!canEdit} className={inputCls} /></Field>
          <Field label="Company domains" hint="e.g. competitor.com, existing-customer.com"><input value={exDom} onChange={(e) => setExDom(e.target.value)} disabled={!canEdit} className={inputCls} /></Field>
          <Field label="Titles"><input value={exTitles} onChange={(e) => setExTitles(e.target.value)} disabled={!canEdit} placeholder="Intern, Student" className={inputCls} /></Field>
        </div>
      </section>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50">
            {pending && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
          {message && (
            <span role="status" className={message.ok ? "inline-flex items-center gap-1.5 text-sm text-green-300" : "text-sm text-red-400"}>
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
