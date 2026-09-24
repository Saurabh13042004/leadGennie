"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Pencil, RefreshCw, Sparkles, X, XCircle } from "lucide-react";
import { approveEmailDraft, generateEmailDraft, rejectEmailDraft, saveDraftEdit } from "@/lib/actions/personalization";
import type { DraftView } from "@/lib/domain/personalization/drafts";
import { TONES, type DraftStatus, type Tone } from "@/lib/domain/personalization/types";
import DraftBody from "./DraftBody";

const TONE_LABEL: Record<Tone, string> = { concise: "Concise", friendly: "Friendly", formal: "Formal", direct: "Direct" };

export const STATUS_STYLE: Record<DraftStatus, { label: string; cls: string }> = {
  draft: { label: "Needs review", cls: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200" },
  edited: { label: "Edited", cls: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200" },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200" },
  failed_validation: { label: "Failed checks", cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" },
};

const inputCls = "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";

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

  const errors = draft?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = draft?.issues.filter((i) => i.severity === "warning") ?? [];
  const status = draft ? STATUS_STYLE[draft.status] : null;
  const canApprove = canEdit && draft && (draft.status === "draft" || draft.status === "edited");

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4" aria-labelledby="draft-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="draft-heading" className="text-sm font-bold text-neutral-900">Email draft</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Uses only verified evidence. Green phrases link to their source. Nothing is sent from here.</p>
        </div>
        {status && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-neutral-50 border border-neutral-200 p-3">
          <label className="text-xs font-medium text-neutral-600">
            Tone
            <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="mt-1 block rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300">
              {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-xs text-neutral-700">
            <input type="checkbox" checked={includeNews} onChange={(e) => setIncludeNews(e.target.checked)} className="rounded accent-indigo-600" />
            Mention recent company news
          </label>
          <button
            onClick={generate}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : draft ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {busy === "generate" ? "Writing and checking…" : draft ? "Regenerate" : "Generate email"}
          </button>
        </div>
      )}

      {!draft && !hasEvidence && (
        <p className="flex items-start gap-2 text-xs text-neutral-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This lead has no verified evidence yet. You can still generate a short, honest note — it just won&apos;t reference anything specific about them. Research the lead first for a personalised one.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {notes.length > 0 && (
        <ul className="space-y-1 text-xs text-neutral-500">{notes.map((n) => <li key={n} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</li>)}</ul>
      )}

      {draft && (
        <div className="space-y-3">
          {draft.status === "failed_validation" && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">This draft broke the evidence rules, so it can&apos;t be approved as written.</p>
                <p className="text-xs text-rose-700/80 mt-0.5">Edit it to fix the problems below, or regenerate. Nothing unverified is ever filled in for you.</p>
              </div>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-600">Subject<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={`${inputCls} mt-1`} /></label>
              <label className="block text-xs font-medium text-neutral-600">Body<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} maxLength={8000} className={`${inputCls} mt-1 font-sans leading-relaxed`} /></label>
              <p className="text-xs text-neutral-500">Your edits are yours: we&apos;ll re-check them and show warnings, but never block you.</p>
              <div className="flex gap-2">
                <button onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors">
                  {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save edits
                </button>
                <button onClick={() => { setEditing(false); setSubject(draft.subject); setBody(draft.body); }} className="rounded-xl px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <p className="text-sm text-neutral-500">Subject: <span className="font-medium text-neutral-900">{draft.subject}</span></p>
              <DraftBody draft={draft} />
            </div>
          )}

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-1.5" aria-label="Checks">
              {errors.map((i, k) => <p key={`e${k}`} className="flex items-start gap-2 text-xs text-rose-600"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{i.message}</p>)}
              {warnings.map((i, k) => <p key={`w${k}`} className="flex items-start gap-2 text-xs text-amber-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{i.message}</p>)}
            </div>
          )}
          {errors.length === 0 && draft.status === "draft" && (
            <p className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Passed all checks — every personal detail is tied to a verified source.</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{draft.claims.length} sourced phrase{draft.claims.length === 1 ? "" : "s"}</span><span>·</span>
            <span>Tone: {TONE_LABEL[draft.tone]}</span><span>·</span>
            <span>{draft.model}</span><span>·</span>
            <span>{draft.attempts === 2 ? "needed one rewrite" : "first pass"}</span>
            {draft.status === "edited" && (
              <button onClick={() => setShowOriginal((v) => !v)} className="ml-1 text-indigo-600 underline hover:text-indigo-700">{showOriginal ? "Hide" : "Show"} original</button>
            )}
          </div>
          {showOriginal && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500 whitespace-pre-wrap">
              <p className="font-medium text-neutral-700">Original (as generated): {draft.originalSubject}</p>
              {draft.originalBody}
            </div>
          )}

          {canEdit && !editing && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
              <button onClick={() => { setEditing(true); setSubject(draft.subject); setBody(draft.body); }} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              {canApprove && (
                <button onClick={approve} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                  {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve draft
                </button>
              )}
              {draft.status !== "rejected" && draft.status !== "approved" && (
                <button onClick={reject} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50 transition-colors"><X className="h-3.5 w-3.5" /> Reject</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
