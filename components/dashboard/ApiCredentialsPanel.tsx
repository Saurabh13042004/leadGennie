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
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">API Credentials</h1>
          <p className="text-sm text-neutral-500">
            Use this token to authenticate the LeadGennie LinkedIn Chrome extension.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 space-y-3">
        <p className="text-sm text-neutral-300">Workspace API token</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white font-mono truncate">
            {freshToken ?? (info.exists ? `${info.prefix ?? "lg_"}…  (hidden)` : "No token yet")}
          </code>
          {freshToken && (
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2.5 transition-colors shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            onClick={generate}
            disabled={working}
            className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2.5 transition-colors shrink-0 disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${working ? "animate-spin" : ""}`} />
            {info.exists ? "Regenerate" : "Generate"}
          </button>
        </div>
        {freshToken ? (
          <p className="text-xs text-amber-400">
            Copy this token now — it is stored hashed and will not be shown again.
          </p>
        ) : (
          <p className="text-xs text-neutral-600">
            For security the token is stored hashed and can&apos;t be displayed again. Lost it? Regenerate — the old one
            stops working immediately.
            {info.lastUsedAt ? ` Last used ${new Date(info.lastUsedAt).toLocaleString()}.` : ""}
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 space-y-4">
        <p className="text-sm text-neutral-300">Extension API reference</p>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Fetch queued LinkedIn messages</p>
          <pre className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-neutral-300 font-mono overflow-x-auto">
{`GET ${origin}/api/extension/queue
Authorization: Bearer ${shownToken}`}
          </pre>
          <p className="text-xs text-neutral-600 mt-1.5">
            Returns queued items: <code className="text-neutral-400">id, body, lead_name, linkedin_url, company, job_title, campaign_name</code>.
          </p>
        </div>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Report a message as sent or failed</p>
          <pre className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-neutral-300 font-mono overflow-x-auto">
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
