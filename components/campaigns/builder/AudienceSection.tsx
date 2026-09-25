"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleNotch, Funnel, UsersThree } from "@phosphor-icons/react/ssr";
import { previewAudience, saveCampaignAudience } from "@/lib/actions/campaign-builder";
import { EXCLUSION_LABEL, EXCLUSION_REASONS, type AudienceDefinition } from "@/lib/domain/campaigns/types";
import type { AudienceView, BuilderView } from "@/lib/domain/campaigns/views";
import { cn } from "@/lib/utils";
import Card, { CardHeader, Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Field";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import type { SegmentOption } from "./CampaignBuilder";
import { Field, Notice, SaveMessage } from "./ui";
import { useSave } from "./useSave";

type Choice = { key: string; name: string; sub: string; def: Partial<AudienceDefinition> };

/** Who gets it — with a live count and every exclusion counted and named. Nobody is dropped silently. */
export default function AudienceSection({ view, segments, editable, onSaved, nav }: { view: BuilderView; segments: SegmentOption[]; editable: boolean; onSaved: (v: BuilderView) => void; nav: BuilderNav }) {
  const c = view.campaign;
  const [def, setDef] = useState<AudienceDefinition>(c.audience);
  const [live, setLive] = useState<AudienceView>(view.readiness.audience);
  const [counting, startCount] = useTransition();
  const [countError, setCountError] = useState<string | null>(null);
  const { pending, message, save } = useSave(onSaved);
  const f = def.filters;
  const setFilter = (patch: Partial<AudienceDefinition["filters"]>) => setDef((d) => ({ ...d, filters: { ...d.filters, ...patch } }));

  useEffect(() => {
    const t = setTimeout(() => {
      startCount(async () => {
        const res = await previewAudience(c.id, def);
        if (res.ok) {
          setLive(res.data);
          setCountError(null);
        } else setCountError(res.error.message);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [c.id, def]);

  const choices: Choice[] = [
    { key: "all", name: "All leads", sub: "Everyone in this workspace", def: { source: "all" } },
    ...segments.map((s) => ({ key: `segment:${s.id}`, name: s.name, sub: "Saved segment", def: { source: "segment" as const, segmentId: s.id } })),
    ...(def.source === "leads" ? [{ key: "leads", name: `${def.leadIds.length} hand-picked leads`, sub: "Selected from the Leads table", def: { source: "leads" as const } }] : []),
  ];
  const activeKey = def.source === "segment" ? `segment:${def.segmentId}` : def.source;
  const excluded = EXCLUSION_REASONS.filter((r) => live.exclusions[r] > 0);
  const excludedTotal = excluded.reduce((a, r) => a + live.exclusions[r], 0);

  return (
    <>
      <StepBody title="Who are you reaching?" description="Pick the leads, narrow them by fit, and see exactly who's excluded and why.">
        <fieldset disabled={!editable || pending} className="space-y-5">
          <Card>
            <CardHeader title="Audience" description="A saved segment or everyone. Final enrollment is re-checked at launch." />
            <div role="radiogroup" aria-label="Audience" className="grid gap-2 p-4 sm:grid-cols-2">
              {choices.map((ch) => {
                const on = activeKey === ch.key;
                return (
                  <button key={ch.key} type="button" role="radio" aria-checked={on} onClick={() => setDef((d) => ({ ...d, ...ch.def }))}
                    className={cn("flex items-center gap-3 rounded-xl px-3.5 py-3 text-left ring-1 ring-inset transition-all", on ? "bg-indigo-50/60 ring-2 ring-indigo-500/70" : "bg-white ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", on ? "bg-white text-indigo-600 ring-indigo-200" : "bg-neutral-50 text-neutral-500 ring-neutral-200/80")}>
                      <UsersThree className="h-4 w-4" weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-neutral-900">{ch.name}</span>
                      <span className="block truncate text-xs text-neutral-500">{ch.sub}</span>
                    </span>
                    <span aria-hidden className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", on ? "bg-indigo-600 ring-indigo-600" : "bg-white ring-neutral-300")}>
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Section title="Fit filters" description="Only reach leads that match your ICP. Leads not researched yet have no score.">
            <div className="space-y-4">
              <Field label="Minimum ICP score" htmlFor="a-icp" hint="optional, 0–100">
                <Input id="a-icp" type="number" min={0} max={100} value={f.minIcpScore ?? ""} placeholder="Any score" className="tabular-nums" onChange={(e) => setFilter({ minIcpScore: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <div className="space-y-2.5 text-[13px] text-neutral-700">
                <label className="flex items-center gap-2.5"><Checkbox checked={f.requireResearched} onChange={(e) => setFilter({ requireResearched: e.target.checked })} /> Only researched leads</label>
                <label className="flex items-center gap-2.5"><Checkbox checked={f.qualifiedOnly} onChange={(e) => setFilter({ qualifiedOnly: e.target.checked })} /> Only leads that qualify against your ICP</label>
                <label className="flex items-center gap-2.5"><Checkbox checked={f.includeRiskyEmails} onChange={(e) => setFilter({ includeRiskyEmails: e.target.checked })} /> Include role and disposable addresses</label>
              </div>
            </div>
          </Section>
        </fieldset>

        <Card>
          <CardHeader
            title="Who's in"
            description={`${live.candidates.toLocaleString()} considered`}
            action={counting ? <CircleNotch className="h-4 w-4 animate-spin text-neutral-400" weight="bold" aria-label="Counting" /> : undefined}
          />
          <div className="space-y-4 p-4" aria-live="polite">
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-semibold leading-8 tracking-tight text-neutral-900 tabular-nums">{live.eligible.toLocaleString()}</span>
              <span className="text-[13px] text-neutral-500">can be emailed</span>
            </div>
            {countError && <Notice tone="error">{countError}</Notice>}
            {live.notes.map((n) => <Notice key={n} tone="info">{n}</Notice>)}
            {live.eligibleSample.length > 0 && (
              <p className="text-xs text-neutral-500">
                Includes {live.eligibleSample.map((l) => l.name).join(", ")}{live.eligible > live.eligibleSample.length ? ` and ${live.eligible - live.eligibleSample.length} more` : ""}.
              </p>
            )}
            {excluded.length > 0 ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500"><Funnel className="h-3.5 w-3.5" weight="duotone" /> Excluded ({excludedTotal})</p>
                <dl className="divide-y divide-neutral-100 rounded-lg ring-1 ring-inset ring-neutral-200/80">
                  {excluded.map((r) => (
                    <div key={r} className="px-3.5 py-2.5">
                      <div className="flex justify-between gap-3 text-[13px]"><dt className="text-neutral-600">{EXCLUSION_LABEL[r]}</dt><dd className="font-medium tabular-nums text-neutral-900">{live.exclusions[r]}</dd></div>
                      {live.samples[r] && <p className="mt-0.5 truncate text-xs text-neutral-400">{live.samples[r]!.map((s) => s.name).join(", ")}{live.exclusions[r] > live.samples[r]!.length ? ", …" : ""}</p>}
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              live.candidates > 0 && <p className="text-[13px] text-neutral-500">Nobody is excluded.</p>
            )}
          </div>
        </Card>
      </StepBody>

      <BuilderFooter nav={nav} hint={`${live.eligible.toLocaleString()} can be emailed`}>
        <SaveMessage message={message} />
        {editable && (
          <Button variant="primary" onClick={() => save(() => saveCampaignAudience(c.id, def))} disabled={pending}>
            {pending && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />} Save
          </Button>
        )}
      </BuilderFooter>
    </>
  );
}
