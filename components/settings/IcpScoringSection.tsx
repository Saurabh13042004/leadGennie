"use client";

import { CircleNotch, Sparkle } from "@phosphor-icons/react/ssr";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Help, Input, Label } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

export type ScoringDraft = {
  minScore: string;
  weights: { industry: string; employee_range: string; geography: string; title: string };
  keywords: string;
};

const WEIGHT_LABELS: [keyof ScoringDraft["weights"], string, string][] = [
  ["industry", "Industry", "bg-indigo-500"],
  ["employee_range", "Company size", "bg-sky-500"],
  ["geography", "Location", "bg-emerald-500"],
  ["title", "Job title", "bg-amber-500"],
];

/** How the engine scores leads against the ICP above. Weights are relative — they are normalized to 100. */
export type KeywordSuggester = { run: () => void; pending: boolean; note: { ok: boolean; text: string } | null };

export default function IcpScoringSection({ value, onChange, canEdit, suggester }: { value: ScoringDraft; onChange: (v: ScoringDraft) => void; canEdit: boolean; suggester?: KeywordSuggester }) {
  const nums = WEIGHT_LABELS.map(([k]) => Math.max(0, Number(value.weights[k]) || 0));
  const total = nums.reduce((a, b) => a + b, 0);

  return (
    <div id="scoring" className="scroll-mt-20">
      <Section
        title="Scoring"
        description={
          <>
            Each lead gets a 0–100 fit score from the criteria above. Criteria we can&apos;t verify count as <em>unknown</em> — they lower confidence, never the score.
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <Label hint="Relative — normalized to 100">Criteria weights</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEIGHT_LABELS.map(([key, label, dot]) => (
                <label key={key} className="block rounded-lg bg-neutral-50/80 p-2.5 ring-1 ring-inset ring-neutral-200/70">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                    <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                    {label}
                  </span>
                  <Input
                    type="number" min={0} max={100} inputMode="numeric" disabled={!canEdit} className="h-8 tabular-nums"
                    value={value.weights[key]}
                    onChange={(e) => onChange({ ...value, weights: { ...value.weights, [key]: e.target.value } })}
                  />
                </label>
              ))}
            </div>
            {total > 0 && (
              <div className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {WEIGHT_LABELS.map(([key, , dot], i) =>
                  nums[i] > 0 ? <span key={key} className={cn("h-full first:rounded-l-full last:rounded-r-full", dot)} style={{ width: `${(nums[i] / total) * 100}%` }} /> : null,
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="icp-keywords">Keywords that signal fit</Label>
              {suggester && canEdit && (
                <Button size="xs" variant="secondary" onClick={suggester.run} disabled={suggester.pending} title="Suggest keywords from what you sell">
                  {suggester.pending ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Sparkle className="h-3.5 w-3.5" weight="fill" />}
                  {suggester.pending ? "Suggesting…" : "Fill with AI"}
                </Button>
              )}
            </div>
            <Input
              id="icp-keywords" disabled={!canEdit} placeholder="outbound, SDR, sales automation"
              value={value.keywords} onChange={(e) => onChange({ ...value, keywords: e.target.value })}
            />
            <Help>
              Words a good-fit <em>company</em> would mention about itself — matched against verified evidence (its own pages, job listings, news). Job titles belong in Target titles above. Together they can add up to about 20 points; a keyword we don&apos;t find is unknown, not a miss.
            </Help>
            {suggester?.note && (
              <p role="status" className={cn("mt-1.5 text-xs", suggester.note.ok ? "text-emerald-600" : "text-rose-600")}>{suggester.note.text}</p>
            )}
          </div>

          <div>
            <Label htmlFor="icp-threshold">Qualified at score ≥</Label>
            <div className="flex items-center gap-2">
              <Input
                id="icp-threshold" type="number" min={0} max={100} inputMode="numeric" disabled={!canEdit} className="w-24 tabular-nums"
                value={value.minScore} onChange={(e) => onChange({ ...value, minScore: e.target.value })}
              />
              <span className="text-xs text-neutral-400">out of 100</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
