"use client";

import { useState, useTransition } from "react";
import { CheckCircle, LockKey, WarningCircle } from "@phosphor-icons/react/ssr";
import { saveWorkspaceProfile, type WorkspaceProfileView } from "@/lib/actions/workspace-profile";
import { parseList, type Icp } from "@/lib/domain/workspace/icp";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Help, Input, Label, Textarea } from "@/components/ui/Field";
import { Spinner } from "./bits";
import IcpScoringSection, { type ScoringDraft } from "./IcpScoringSection";
import IcpTestPanel from "./IcpTestPanel";

const join = (l: string[]) => l.join(", ");

function Field({ id, label, hint, help, children }: { id: string; label: string; hint?: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {children}
      {help && <Help>{help}</Help>}
    </div>
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
    <form onSubmit={submit} className="space-y-5">
      <Section title="What you sell" description="The starting point for every message. Be specific about the problem you solve.">
        <div className="space-y-4">
          <Field id="pf-company" label="Company name">
            <Input id="pf-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEdit} maxLength={200} placeholder="Acme Inc." />
          </Field>
          <Field id="pf-positioning" label="Positioning" hint={`${positioning.length}/2000`} help="e.g. “We help B2B SaaS founders book 10 qualified demos a month without hiring an SDR.”">
            <Textarea id="pf-positioning" value={positioning} onChange={(e) => setPositioning(e.target.value)} disabled={!canEdit} maxLength={2000} rows={4} />
          </Field>
        </div>
      </Section>

      <div id="icp" className="scroll-mt-20">
        <Section title="Ideal customer profile" description="Who you want to reach. Separate values with commas; leave a field blank to not restrict on it.">
          <div className="space-y-4">
            <Field id="pf-industries" label="Industries">
              <Input id="pf-industries" value={industries} onChange={(e) => setIndustries(e.target.value)} disabled={!canEdit} placeholder="B2B SaaS, Fintech" />
            </Field>
            <div>
              <Label htmlFor="pf-min">Company size</Label>
              <div className="flex items-center gap-2">
                <Input id="pf-min" aria-label="Min employees" inputMode="numeric" value={minEmp} onChange={(e) => setMinEmp(e.target.value)} disabled={!canEdit} placeholder="50" />
                <span className="shrink-0 text-xs text-neutral-400">to</span>
                <Input aria-label="Max employees" inputMode="numeric" value={maxEmp} onChange={(e) => setMaxEmp(e.target.value)} disabled={!canEdit} placeholder="500" />
                <span className="shrink-0 text-xs text-neutral-400">employees</span>
              </div>
            </div>
            <Field id="pf-geo" label="Geographies">
              <Input id="pf-geo" value={geographies} onChange={(e) => setGeographies(e.target.value)} disabled={!canEdit} placeholder="United States, India, EMEA" />
            </Field>
            <Field id="pf-titles" label="Target titles">
              <Input id="pf-titles" value={titles} onChange={(e) => setTitles(e.target.value)} disabled={!canEdit} placeholder="VP Sales, Head of Growth, Founder" />
            </Field>
          </div>
        </Section>
      </div>

      <Section title="Exclusions" description="Never target these, even when everything else matches.">
        <div className="space-y-4">
          <Field id="pf-ex-ind" label="Industries">
            <Input id="pf-ex-ind" value={exInd} onChange={(e) => setExInd(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field id="pf-ex-dom" label="Company domains" help="e.g. competitor.com, existing-customer.com">
            <Input id="pf-ex-dom" value={exDom} onChange={(e) => setExDom(e.target.value)} disabled={!canEdit} />
          </Field>
          <Field id="pf-ex-titles" label="Titles">
            <Input id="pf-ex-titles" value={exTitles} onChange={(e) => setExTitles(e.target.value)} disabled={!canEdit} placeholder="Intern, Student" />
          </Field>
        </div>
      </Section>

      <IcpScoringSection value={scoring} onChange={setScoring} canEdit={canEdit} />

      <IcpTestPanel getIcp={buildIcp} />

      <div className="sticky bottom-4 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.12)] ring-1 ring-neutral-200/80 backdrop-blur">
          {canEdit ? (
            <>
              <div className="min-w-0 text-[13px]" role="status">
                {message ? (
                  <span className={message.ok ? "inline-flex items-center gap-1.5 text-emerald-700" : "inline-flex items-center gap-1.5 text-rose-600"}>
                    {message.ok ? <CheckCircle className="h-4 w-4 shrink-0" weight="fill" /> : <WarningCircle className="h-4 w-4 shrink-0" weight="fill" />}
                    {message.text}
                  </span>
                ) : (
                  <span className="text-neutral-500">Shared by everyone in this workspace.</span>
                )}
              </div>
              <Button type="submit" variant="primary" disabled={pending} className="min-w-24">
                {pending && <Spinner className="h-3.5 w-3.5" />} Save changes
              </Button>
            </>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500">
              <LockKey className="h-4 w-4 text-neutral-400" weight="duotone" /> Only workspace owners and admins can edit this.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
