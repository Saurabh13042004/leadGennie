"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Copy, Ban, Check, X } from "lucide-react";
import {
  updateDraftVersion,
  submitForApproval,
  deprecateVersion,
  cloneVersion,
  type PromptVersion,
  type SchemaField,
} from "@/lib/actions/prompts";
import { decideApproval } from "@/lib/actions/approvals";
import SchemaFieldEditor from "./SchemaFieldEditor";
import VersionTestPanel from "./VersionTestPanel";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  published: "Published",
  deprecated: "Deprecated",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200",
  pending_approval: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  published: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  deprecated: "bg-neutral-100 text-neutral-400 ring-1 ring-inset ring-neutral-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

const textareaClass =
  "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60 resize-none";

export default function VersionEditor({
  version,
  canManage,
  canApprove,
}: {
  version: PromptVersion;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const isDraft = version.status === "draft";
  const isEditable = isDraft && canManage;

  const [template, setTemplate] = useState(version.template);
  const [inputSchema, setInputSchema] = useState<SchemaField[]>(version.inputSchema);
  const [outputSchema, setOutputSchema] = useState<SchemaField[]>(version.outputSchema);
  const [toneRules, setToneRules] = useState(version.toneRules ?? "");
  const [prohibitedClaims, setProhibitedClaims] = useState(version.prohibitedClaims ?? "");
  const [requiredSources, setRequiredSources] = useState(version.requiredSources ?? "");
  const [evalNotes, setEvalNotes] = useState(version.evalNotes ?? "");

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDraft() {
    await updateDraftVersion(version.id, {
      template,
      inputSchema,
      outputSchema,
      toneRules: toneRules || null,
      prohibitedClaims: prohibitedClaims || null,
      requiredSources: requiredSources || null,
      evalNotes: evalNotes || null,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveDraft();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await submitForApproval(version.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit for approval");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecide(decision: "approved" | "rejected") {
    if (!version.approvalId) return;
    setBusy(true);
    setError(null);
    try {
      await decideApproval(version.approvalId, decision);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record decision");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeprecate() {
    setBusy(true);
    setError(null);
    try {
      await deprecateVersion(version.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not deprecate");
    } finally {
      setBusy(false);
    }
  }

  async function handleClone() {
    setBusy(true);
    setError(null);
    try {
      const result = await cloneVersion(version.id);
      router.refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clone");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-neutral-900 font-semibold">Version {version.versionNumber}</h2>
          <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_BADGE[version.status]}`}>
            {STATUS_LABEL[version.status]}
          </span>
          <span className="text-xs text-neutral-400">{version.model}</span>
        </div>
        <div className="flex items-center gap-2">
          {version.status === "pending_approval" && canApprove && (
            <>
              <button
                onClick={() => handleDecide("approved")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & publish
              </button>
              <button
                onClick={() => handleDecide("rejected")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}
          {version.status === "published" && canApprove && (
            <button
              onClick={handleDeprecate}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-rose-600 border border-neutral-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              Deprecate
            </button>
          )}
          {!isDraft && canManage && (
            <button
              onClick={handleClone}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Clone to edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {version.status === "pending_approval" && !canApprove && (
        <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          Waiting on an owner/admin to review this version.
        </p>
      )}
      {version.status === "rejected" && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          This version was rejected. Clone it to make changes and resubmit.
        </p>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Template <span className="text-neutral-400 font-normal">— use {"{{"} field_key {"}}"} placeholders</span>
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            disabled={!isEditable}
            rows={8}
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60 resize-none font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Input fields</label>
            <SchemaFieldEditor fields={inputSchema} onChange={setInputSchema} showType={false} disabled={!isEditable} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Output schema <span className="text-neutral-400 font-normal">(validated on test)</span>
            </label>
            <SchemaFieldEditor fields={outputSchema} onChange={setOutputSchema} showType disabled={!isEditable} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Tone / localization rules</label>
            <textarea
              value={toneRules}
              onChange={(e) => setToneRules(e.target.value)}
              disabled={!isEditable}
              rows={2}
              className={textareaClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Prohibited claims</label>
            <textarea
              value={prohibitedClaims}
              onChange={(e) => setProhibitedClaims(e.target.value)}
              disabled={!isEditable}
              rows={2}
              className={textareaClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Required sources</label>
            <textarea
              value={requiredSources}
              onChange={(e) => setRequiredSources(e.target.value)}
              disabled={!isEditable}
              rows={2}
              className={textareaClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Evaluation notes</label>
            <textarea
              value={evalNotes}
              onChange={(e) => setEvalNotes(e.target.value)}
              disabled={!isEditable}
              rows={2}
              className={textareaClass}
            />
          </div>
        </div>

        {isEditable && (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save draft
            </button>
          </div>
        )}
      </div>

      <VersionTestPanel
        versionId={version.id}
        inputSchema={inputSchema}
        isEditable={isEditable}
        isDraft={isDraft}
        lastTestPassed={version.lastTestPassed}
        beforeTest={saveDraft}
        onTested={() => router.refresh()}
      />

      {isDraft && canManage && (
        <button
          onClick={handleSubmit}
          disabled={busy || !version.lastTestPassed}
          className="flex items-center gap-2 text-sm bg-neutral-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Submit for approval
        </button>
      )}
    </div>
  );
}
