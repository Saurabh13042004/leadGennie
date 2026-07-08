"use client";

import { useState } from "react";
import { Copy, Check, RotateCw, KeyRound } from "lucide-react";
import { regenerateApiToken } from "@/lib/actions/api-tokens";

export default function ApiCredentialsPanel({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    if (!confirm("Regenerate token? Any extension using the old token will stop working.")) return;
    setRegenerating(true);
    try {
      const next = await regenerateApiToken();
      setToken(next);
    } finally {
      setRegenerating(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";

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
        <p className="text-sm text-neutral-300">Personal API token</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white font-mono truncate">
            {token}
          </code>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2.5 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2.5 transition-colors shrink-0 disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        </div>
        <p className="text-xs text-neutral-600">Keep this secret — anyone with it can read and mark your queued LinkedIn sends.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 space-y-4">
        <p className="text-sm text-neutral-300">Extension API reference</p>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Fetch queued LinkedIn messages</p>
          <pre className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-neutral-300 font-mono overflow-x-auto">
{`GET ${origin}/api/extension/queue
Authorization: Bearer ${token}`}
          </pre>
          <p className="text-xs text-neutral-600 mt-1.5">
            Returns queued items: <code className="text-neutral-400">id, body, lead_name, linkedin_url, company, job_title, campaign_name</code>.
          </p>
        </div>

        <div>
          <p className="text-xs text-neutral-500 mb-1.5">Report a message as sent or failed</p>
          <pre className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-xs text-neutral-300 font-mono overflow-x-auto">
{`POST ${origin}/api/extension/queue
Authorization: Bearer ${token}
Content-Type: application/json

{ "id": 123, "status": "sent" }`}
          </pre>
        </div>
      </div>
    </div>
  );
}
