"use client";

import { CheckCircle, CircleNotch, Warning, XCircle } from "@phosphor-icons/react/ssr";
import type { ValidationIssue } from "@/lib/domain/personalization/types";
import Button from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";

/** Subject/body editor for a draft. State lives in DraftPanel; this only renders it. */
export function DraftEditor({
  subject, body, onSubject, onBody, saving, disabled, onSave, onCancel,
}: {
  subject: string;
  body: string;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="draft-subject">Subject</Label>
        <Input id="draft-subject" value={subject} onChange={(e) => onSubject(e.target.value)} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="draft-body">Body</Label>
        <Textarea id="draft-body" value={body} onChange={(e) => onBody(e.target.value)} rows={12} maxLength={8000} className="font-sans" />
      </div>
      <p className="text-xs text-neutral-500">Your edits are yours: we&apos;ll re-check them and show warnings, but never block you.</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onSave} disabled={disabled}>
          {saving && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />} Save edits
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** Validator output: errors, warnings, or the all-clear for a clean generated draft. */
export function DraftChecks({ issues, passed }: { issues: ValidationIssue[]; passed: boolean }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <>
      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="space-y-1.5" aria-label="Checks">
          {errors.map((i, k) => (
            <li key={`e${k}`} className="flex items-start gap-2 text-xs text-rose-700">
              <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-500" weight="fill" />
              {i.message}
            </li>
          ))}
          {warnings.map((i, k) => (
            <li key={`w${k}`} className="flex items-start gap-2 text-xs text-amber-700">
              <Warning className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" weight="fill" />
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {errors.length === 0 && passed && (
        <p className="flex items-center gap-2 text-xs text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" weight="fill" /> Passed all checks — every personal detail is tied to a verified source.
        </p>
      )}
    </>
  );
}
