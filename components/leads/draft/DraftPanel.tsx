"use client";

import { useState, useTransition } from "react";
import { ArrowClockwise, CheckCircle, CircleNotch, Info, PencilSimple, PencilSimpleLine, Sparkle, X, XCircle } from "@phosphor-icons/react/ssr";
import { approveEmailDraft, generateEmailDraft, rejectEmailDraft, saveDraftEdit } from "@/lib/actions/personalization";
import type { DraftView } from "@/lib/domain/personalization/drafts";
import { TONES, type DraftStatus, type Tone } from "@/lib/domain/personalization/types";
import Button, { buttonClasses } from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Field";
import { TONE as BADGE_TONE } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import Callout from "../intel/Callout";
import { AI_BUTTON } from "../ai-styles";
import DraftBody from "./DraftBody";
import { DraftChecks, DraftEditor } from "./DraftParts";

const TONE_LABEL: Record<Tone, string> = { concise: "Concise", friendly: "Friendly", formal: "Formal", direct: "Direct" };

export const STATUS_STYLE: Record<DraftStatus, { label: string; cls: string }> = {
  draft: { label: "Needs review", cls: `ring-1 ring-inset ${BADGE_TONE.indigo.badge}` },
  edited: { label: "Edited", cls: `ring-1 ring-inset ${BADGE_TONE.violet.badge}` },
  approved: { label: "Approved", cls: `ring-1 ring-inset ${BADGE_TONE.emerald.badge}` },
  rejected: { label: "Rejected", cls: `ring-1 ring-inset ${BADGE_TONE.neutral.badge}` },
  failed_validation: { label: "Failed checks", cls: `ring-1 ring-inset ${BADGE_TONE.rose.badge}` },
};

export default function DraftPanel({
  leadId, initial, defaultTone, canEdit, hasEvidence,
}: {
  leadId: number;
  initial: DraftView | null;
  defaultTone: Tone;
  canEdit: boolean;
  hasEvidence: boolean;
}) {
  const [draft, setDraft] = useState<DraftView | null>(initial);
  const [tone, setTone] = useState<Tone>(initial?.tone ?? defaultTone);
  const [includeNews, setIncludeNews] = useState(initial?.includeNews ?? false);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"generate" | "save" | "approve" | "reject" | null>(null);

  function run<T>(kind: NonNullable<typeof busy>, work: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>, onOk: (d: T) => void) {
    setError(null);
    setBusy(kind);
    start(async () => {
      const res = await work();
      setBusy(null);
      if (!res.ok) return setError(res.error.message);
      onOk(res.data);
    });
  }

  const generate = () =>
    run("generate", () => generateEmailDraft(leadId, { tone, includeNews }), (d: DraftView) => {
      setDraft(d);
      setNotes(d.notes ?? []);
      setSubject(d.subject);
      setBody(d.body);
      setEditing(false);
    });

  const save = () =>
    run("save", () => saveDraftEdit(draft!.id, { subject, body }), (d: DraftView) => {
      setDraft(d);
      setEditing(false);
    });

  const approve = () => run("approve", () => approveEmailDraft(draft!.id), (d: DraftView) => setDraft(d));
  const reject = () => run("reject", () => rejectEmailDraft(draft!.id), (d: DraftView) => setDraft(d));

  const status = draft ? STATUS_STYLE[draft.status] : null;
  const canApprove = canEdit && draft && (draft.status === "draft" || draft.status === "edited");

  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]" aria-labelledby="draft-heading">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <PencilSimpleLine className="mt-px h-4 w-4 shrink-0 text-violet-500" weight="duotone" />
          <div className="min-w-0">
            <h2 id="draft-heading" className="text-[13px] font-semibold text-neutral-900">Email draft</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Uses only verified evidence. Green phrases link to their source. Nothing is sent from here.</p>
          </div>
        </div>
        {status && <span className={cn("inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium", status.cls)}>{status.label}</span>}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
            Tone
            <Select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="w-32">
              {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
            </Select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
            <Checkbox checked={includeNews} onChange={(e) => setIncludeNews(e.target.checked)} />
            Mention recent company news
          </label>
          <button type="button" onClick={generate} disabled={pending} className={buttonClasses({ variant: "primary", size: "md", className: cn("ml-auto", AI_BUTTON) })}>
            {busy === "generate" ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : draft ? <ArrowClockwise className="h-4 w-4" weight="bold" /> : <Sparkle className="h-4 w-4" weight="fill" />}
            {busy === "generate" ? "Writing and checking…" : draft ? "Regenerate" : "Generate email"}
          </button>
        </div>
      )}

      <div className="space-y-3 p-4">
        {!draft && !hasEvidence && (
          <Callout tone="neutral" icon={Info}>
            This lead has no verified evidence yet. You can still generate a short, honest note — it just won&apos;t reference anything specific about them. Research the lead first for a personalised one.
          </Callout>
        )}
        {error && <Callout tone="error" icon={XCircle} role="alert">{error}</Callout>}
        {notes.length > 0 && (
          <ul className="space-y-1 text-xs text-neutral-500">{notes.map((n) => <li key={n} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />{n}</li>)}</ul>
        )}

        {draft && (
          <>
            {draft.status === "failed_validation" && (
              <Callout tone="error" icon={XCircle} role="alert" title={<>This draft broke the evidence rules, so it can&apos;t be approved as written.</>}>
                Edit it to fix the problems below, or regenerate. Nothing unverified is ever filled in for you.
              </Callout>
            )}

            {editing ? (
              <DraftEditor
                subject={subject}
                body={body}
                onSubject={setSubject}
                onBody={setBody}
                saving={busy === "save"}
                disabled={pending}
                onSave={save}
                onCancel={() => { setEditing(false); setSubject(draft.subject); setBody(draft.body); }}
              />
            ) : (
              <div className="overflow-hidden rounded-lg ring-1 ring-inset ring-neutral-200">
                <div className="flex items-baseline gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5 text-[13px]">
                  <span className="w-14 shrink-0 text-xs text-neutral-400">Subject</span>
                  <span className="min-w-0 font-medium text-neutral-900">{draft.subject}</span>
                </div>
                <div className="px-4 py-3.5">
                  <DraftBody draft={draft} />
                </div>
              </div>
            )}

            <DraftChecks issues={draft.issues} passed={draft.status === "draft"} />

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
              <span>{draft.claims.length} sourced phrase{draft.claims.length === 1 ? "" : "s"}</span><span>·</span>
              <span>Tone: {TONE_LABEL[draft.tone]}</span><span>·</span>
              <span>{draft.model}</span><span>·</span>
              <span>{draft.attempts === 2 ? "needed one rewrite" : "first pass"}</span>
              {draft.status === "edited" && (
                <button type="button" onClick={() => setShowOriginal((v) => !v)} className="ml-1 font-medium text-indigo-600 hover:text-indigo-800">{showOriginal ? "Hide" : "Show"} original</button>
              )}
            </div>
            {showOriginal && (
              <div className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500 ring-1 ring-inset ring-neutral-200/80">
                <p className="font-medium text-neutral-700">Original (as generated): {draft.originalSubject}</p>
                {draft.originalBody}
              </div>
            )}
          </>
        )}
      </div>

      {draft && canEdit && !editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
          {canApprove && (
            <Button variant="accent" onClick={approve} disabled={pending}>
              {busy === "approve" ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <CheckCircle className="h-4 w-4" weight="fill" />} Approve draft
            </Button>
          )}
          <Button variant="secondary" onClick={() => { setEditing(true); setSubject(draft.subject); setBody(draft.body); }}>
            <PencilSimple className="h-4 w-4" weight="bold" />Edit
          </Button>
          {draft.status !== "rejected" && draft.status !== "approved" && (
            <Button variant="ghost" onClick={reject} disabled={pending} className="ml-auto">
              <X className="h-4 w-4" weight="bold" /> Reject
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
