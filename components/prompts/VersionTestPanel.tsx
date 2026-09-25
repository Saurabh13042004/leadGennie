"use client";

import { useState } from "react";
import { CheckCircle, Flask, XCircle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { testVersion, type SchemaField } from "@/lib/actions/prompts";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Callout, Spinner } from "@/components/settings/bits";

/**
 * The "test this version" card on the prompt version editor: sample input
 * fields, a run button, and the pass/fail result. Split out of VersionEditor
 * so each file stays focused and under the component size budget.
 */
export default function VersionTestPanel({
  versionId,
  inputSchema,
  isEditable,
  isDraft,
  lastTestPassed,
  beforeTest,
  onTested,
}: {
  versionId: number;
  inputSchema: SchemaField[];
  isEditable: boolean;
  isDraft: boolean;
  lastTestPassed: boolean | null;
  /** Persists the current draft edits before the test runs against them. */
  beforeTest: () => Promise<void>;
  onTested: () => void;
}) {
  const [sampleInput, setSampleInput] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ passed: boolean; output: unknown; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      await beforeTest();
      const result = await testVersion(versionId, sampleInput);
      setTestResult(result);
      onTested();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed unexpectedly");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
        <Flask className="h-4 w-4 text-indigo-600" weight="duotone" />
        <h3 className="text-[13px] font-semibold text-neutral-900">Test this version</h3>
      </div>
      <div className="space-y-3 p-4">
        {inputSchema.length > 0 && (
          <div className="space-y-2">
            {inputSchema.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block font-mono text-[11px] text-neutral-500">{f.key || "(unnamed field)"}</label>
                <Input
                  value={sampleInput[f.key] ?? ""}
                  onChange={(e) => setSampleInput((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        {error && <Callout className="text-xs">{error}</Callout>}

        <Button variant="accent" onClick={handleTest} disabled={testing || !isEditable} className="w-full">
          {testing ? <Spinner className="h-3.5 w-3.5" /> : <Flask className="h-3.5 w-3.5" weight="bold" />}
          Run test
        </Button>

        {testResult && (
          <div
            className={cn(
              "space-y-1 rounded-lg px-3 py-2 text-xs ring-1 ring-inset",
              testResult.passed ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70" : "bg-rose-50 text-rose-700 ring-rose-200/70"
            )}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              {testResult.passed ? <CheckCircle className="h-3.5 w-3.5" weight="fill" /> : <XCircle className="h-3.5 w-3.5" weight="fill" />}
              {testResult.passed ? "Passed schema validation" : "Failed validation"}
            </p>
            {testResult.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
            {testResult.output ? (
              <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white/70 p-2 font-mono text-[11px] text-neutral-700 ring-1 ring-inset ring-black/5">
                {JSON.stringify(testResult.output, null, 2)}
              </pre>
            ) : null}
          </div>
        )}

        {!lastTestPassed && isDraft && (
          <p className="text-xs text-neutral-500">Run a passing test before this version can be submitted.</p>
        )}
      </div>
    </Card>
  );
}
