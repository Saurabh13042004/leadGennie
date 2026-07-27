"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FlaskConical, Send, Copy, Ban, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateDraftVersion,
  testVersion,
  submitForApproval,
  deprecateVersion,
  cloneVersion,
  type PromptVersion,
  type SchemaField,
} from "@/lib/actions/prompts";
import { decideApproval } from "@/lib/actions/approvals";
import SchemaFieldEditor from "./SchemaFieldEditor";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  published: "Published",
  deprecated: "Deprecated",
  rejected: "Rejected",
};

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
  const [sampleInput, setSampleInput] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: boolean; output: unknown; errors: string[] } | null>(null);
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

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      await saveDraft();
      const result = await testVersion(version.id, sampleInput);
      setTestResult(result);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed unexpectedly");
    } finally {
      setTesting(false);
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
          <h2 className="text-white font-medium">Version {version.versionNumber}</h2>
          <span className="text-xs text-neutral-400 border border-white/10 rounded-full px-2.5 py-1">
            {STATUS_LABEL[version.status]}
          </span>
          <span className="text-xs text-neutral-600">{version.model}</span>
        </div>
        <div className="flex items-center gap-2">
          {version.status === "pending_approval" && canApprove && (
            <>
              <button
                onClick={() => handleDecide("approved")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-black bg-white hover:bg-neutral-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & publish
              </button>
              <button
                onClick={() => handleDecide("rejected")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
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
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-400 border border-white/10 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              Deprecate
            </button>
          )}
          {!isDraft && canManage && (
            <button
              onClick={handleClone}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Clone to edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {version.status === "pending_approval" && !canApprove && (
        <p className="text-sm text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
          Waiting on an owner/admin to review this version.
        </p>
      )}
      {version.status === "rejected" && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          This version was rejected. Clone it to make changes and resubmit.
        </p>
      )}

      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">
          Template <span className="text-neutral-600">— use {"{{"} field_key {"}}"}  placeholders</span>
        </label>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          disabled={!isEditable}
          rows={8}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-70 resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Input fields</label>
          <SchemaFieldEditor fields={inputSchema} onChange={setInputSchema} showType={false} disabled={!isEditable} />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Output schema (validated on test)</label>
          <SchemaFieldEditor fields={outputSchema} onChange={setOutputSchema} showType disabled={!isEditable} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Tone / localization rules</label>
          <textarea
            value={toneRules}
            onChange={(e) => setToneRules(e.target.value)}
            disabled={!isEditable}
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-70 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Prohibited claims</label>
          <textarea
            value={prohibitedClaims}
            onChange={(e) => setProhibitedClaims(e.target.value)}
            disabled={!isEditable}
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-70 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Required sources</label>
          <textarea
            value={requiredSources}
            onChange={(e) => setRequiredSources(e.target.value)}
            disabled={!isEditable}
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-70 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Evaluation notes</label>
          <textarea
            value={evalNotes}
            onChange={(e) => setEvalNotes(e.target.value)}
            disabled={!isEditable}
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-70 resize-none"
          />
        </div>
      </div>

      {isEditable && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 text-sm text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save draft
          </button>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-medium text-white">Test this version</p>
        </div>

        {inputSchema.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {inputSchema.map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-neutral-500 mb-1">{f.key || "(unnamed field)"}</label>
                <input
                  value={sampleInput[f.key] ?? ""}
                  onChange={(e) => setSampleInput((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={testing || !isEditable}
          className={cn(
            "flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
            "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20"
          )}
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
          Run test
        </button>

        {testResult && (
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs space-y-1",
              testResult.passed
                ? "border-green-500/20 bg-green-500/5 text-green-300"
                : "border-red-500/20 bg-red-500/5 text-red-300"
            )}
          >
            <p className="font-medium">{testResult.passed ? "Passed schema validation" : "Failed validation"}</p>
            {testResult.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
            {testResult.output ? (
              <pre className="text-neutral-400 whitespace-pre-wrap break-words mt-1">
                {JSON.stringify(testResult.output, null, 2)}
              </pre>
            ) : null}
          </div>
        )}

        {!version.lastTestPassed && isDraft && (
          <p className="text-xs text-neutral-600">Run a passing test before this version can be submitted.</p>
        )}

        {isDraft && canManage && (
          <button
            onClick={handleSubmit}
            disabled={busy || !version.lastTestPassed}
            className="flex items-center gap-2 text-sm bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit for approval
          </button>
        )}
      </div>
    </div>
  );
}
