"use client";

import { useState } from "react";
import { Copy, Check, RotateCw, KeyRound } from "lucide-react";
import { regenerateApiToken, type ApiTokenInfo } from "@/lib/actions/api-tokens";

export default function ApiCredentialsPanel({ initialInfo }: { initialInfo: ApiTokenInfo }) {
  const [info, setInfo] = useState(initialInfo);
  // Plaintext exists only in this component's memory, right after generation.
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function generate() {
    const message = info.exists
      ? "Regenerate token? Any extension using the old token will stop working."
      : "Generate an API token for this workspace?";
    if (!confirm(message)) return;
    setWorking(true);
    setError(null);
    try {
      const next = await regenerateApiToken();
      setFreshToken(next);
      setInfo({ exists: true, prefix: next.slice(0, 8), createdAt: new Date().toISOString(), lastUsedAt: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a token.");
    } finally {
      setWorking(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.example.com";
  const shownToken = freshToken ?? "<your-api-token>";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">API Credentials</h1>
          <p className="text-sm text-neutral-500">
            Use this token to authenticate the LeadGennie LinkedIn Chrome extension.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-3">
        <p className="text-sm font-semibold text-neutral-900">Workspace API token</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <code className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 font-mono truncate">
            {freshToken ?? (info.exists ? `${info.prefix ?? "lg_"}…  (hidden)` : "No token yet")}
          </code>
          <div className="flex items-center gap-2 shrink-0">
            {freshToken && (
              <button
                onClick={copy}
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 bg-white rounded-lg px-3 py-2.5 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={generate}
              disabled={working}
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 bg-white rounded-lg px-3 py-2.5 hover:bg-neutral-50 hover:border-neutral-300 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${working ? "animate-spin" : ""}`} />
              {info.exists ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>
        {freshToken ? (
          <p className="text-xs text-amber-600 font-medium">
            Copy this token now — it is stored hashed and will not be shown again.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            For security the token is stored hashed and can&apos;t be displayed again. Lost it? Regenerate — the old one
            stops working immediately.
            {info.lastUsedAt ? ` Last used ${new Date(info.lastUsedAt).toLocaleString()}.` : ""}
          </p>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-4">
        <p className="text-sm font-semibold text-neutral-900">Extension API reference</p>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Fetch queued LinkedIn messages</p>
          <pre className="rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-xs text-neutral-700 font-mono overflow-x-auto">
{`GET ${origin}/api/extension/queue
Authorization: Bearer ${shownToken}`}
          </pre>
          <p className="text-xs text-neutral-500 mt-1.5">
            Returns queued items: <code className="text-neutral-600">id, body, lead_name, linkedin_url, company, job_title, campaign_name</code>.
          </p>
        </div>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Report a message as sent or failed</p>
          <pre className="rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-xs text-neutral-700 font-mono overflow-x-auto">
{`POST ${origin}/api/extension/queue
Authorization: Bearer ${shownToken}
Content-Type: application/json

{ "id": 123, "status": "sent" }`}
          </pre>
        </div>
      </div>
    </div>
  );
}
