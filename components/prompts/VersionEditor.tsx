"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, LockKey } from "@phosphor-icons/react/ssr";
import {
  updateDraftVersion,
  submitForApproval,
  deprecateVersion,
  cloneVersion,
  type PromptVersion,
  type SchemaField,
} from "@/lib/actions/prompts";
import { decideApproval } from "@/lib/actions/approvals";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";
import { Callout, Spinner } from "@/components/settings/bits";
import SchemaFieldEditor from "./SchemaFieldEditor";
import VersionSidebar from "./VersionSidebar";
import VersionTestPanel from "./VersionTestPanel";

function Block({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-4 md:px-5">
      <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

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

  /** Runs a lifecycle action with the shared busy/error handling, then refreshes the page data. */
  async function act(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const handleSubmit = () => act(() => submitForApproval(version.id), "Could not submit for approval");
  const handleDecide = (decision: "approved" | "rejected") => {
    if (!version.approvalId) return;
    const approvalId = version.approvalId;
    return act(() => decideApproval(approvalId, decision), "Could not record decision");
  };
  const handleDeprecate = () => act(() => deprecateVersion(version.id), "Could not deprecate");
  const handleClone = () => act(() => cloneVersion(version.id), "Could not clone");

  const guardrails: [string, string, (v: string) => void, string][] = [
    ["Tone / localization rules", toneRules, setToneRules, "pv-tone"],
    ["Prohibited claims", prohibitedClaims, setProhibitedClaims, "pv-prohibited"],
    ["Required sources", requiredSources, setRequiredSources, "pv-sources"],
    ["Evaluation notes", evalNotes, setEvalNotes, "pv-eval"],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        {error && <Callout>{error}</Callout>}
        {version.status === "pending_approval" && !canApprove && (
          <Callout tone="info" role="status">Waiting on an owner/admin to review this version.</Callout>
        )}
        {version.status === "rejected" && <Callout>This version was rejected. Clone it to make changes and resubmit.</Callout>}
        {!isDraft && version.status !== "rejected" && (
          <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <LockKey className="h-3.5 w-3.5 text-neutral-400" weight="duotone" /> Only drafts can be edited — clone this version to change it.
          </p>
        )}

        <Card className="divide-y divide-neutral-100">
          <Block title="Template" description={<>Use <code className="rounded bg-neutral-100 px-1 font-mono text-[11px] text-neutral-700">{"{{field_key}}"}</code> placeholders for input fields.</>}>
            <Textarea
              aria-label="Template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={!isEditable}
              rows={9}
              className="resize-y font-mono text-[12.5px]"
            />
          </Block>

          <div className="grid divide-y divide-neutral-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
            <Block title="Input fields" description="Values filled in for each lead.">
              <SchemaFieldEditor fields={inputSchema} onChange={setInputSchema} showType={false} disabled={!isEditable} />
            </Block>
            <Block title="Output schema" description="The model's answer is validated against this on test.">
              <SchemaFieldEditor fields={outputSchema} onChange={setOutputSchema} showType disabled={!isEditable} />
            </Block>
          </div>

          <Block title="Guardrails" description="Rules the generated message must follow.">
            <div className="grid gap-3 sm:grid-cols-2">
              {guardrails.map(([label, value, set, id]) => (
                <div key={id}>
                  <Label htmlFor={id}>{label}</Label>
                  <Textarea id={id} value={value} onChange={(e) => set(e.target.value)} disabled={!isEditable} rows={2} className="resize-none text-xs" />
                </div>
              ))}
            </div>
          </Block>

          {isEditable && (
            <div className="flex items-center justify-end gap-2 rounded-b-xl bg-neutral-50/60 px-4 py-3 md:px-5">
              <span className="mr-auto text-xs text-neutral-500">Running a test also saves your changes.</span>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner className="h-3.5 w-3.5" /> : <FloppyDisk className="h-3.5 w-3.5" weight="bold" />}
                Save draft
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <VersionSidebar
          version={version}
          canManage={canManage}
          canApprove={canApprove}
          busy={busy}
          onDecide={handleDecide}
          onDeprecate={handleDeprecate}
          onClone={handleClone}
          onSubmit={handleSubmit}
        />
        <VersionTestPanel
          versionId={version.id}
          inputSchema={inputSchema}
          isEditable={isEditable}
          isDraft={isDraft}
          lastTestPassed={version.lastTestPassed}
          beforeTest={saveDraft}
          onTested={() => router.refresh()}
        />
      </div>
    </div>
  );
}
