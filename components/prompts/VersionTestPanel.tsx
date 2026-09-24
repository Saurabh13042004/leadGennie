"use client";

import { useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { testVersion, type SchemaField } from "@/lib/actions/prompts";

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
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-indigo-600" />
        <p className="text-sm font-semibold text-neutral-900">Test this version</p>
      </div>

      {inputSchema.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {inputSchema.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-neutral-500 mb-1">{f.key || "(unnamed field)"}</label>
              <input
                value={sampleInput[f.key] ?? ""}
                onChange={(e) => setSampleInput((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-lg bg-white border border-neutral-200 px-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleTest}
        disabled={testing || !isEditable}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
      >
        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
        Run test
      </button>

      {testResult && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs space-y-1",
            testResult.passed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          <p className="font-semibold">{testResult.passed ? "Passed schema validation" : "Failed validation"}</p>
          {testResult.errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          {testResult.output ? (
            <pre className="text-neutral-600 whitespace-pre-wrap break-words mt-1">
              {JSON.stringify(testResult.output, null, 2)}
            </pre>
          ) : null}
        </div>
      )}

      {!lastTestPassed && isDraft && (
        <p className="text-xs text-neutral-500">Run a passing test before this version can be submitted.</p>
      )}
    </div>
  );
}
