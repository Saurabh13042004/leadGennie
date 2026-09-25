"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowsClockwise, Check, Copy, Key } from "@phosphor-icons/react/ssr";
import { regenerateApiToken, type ApiTokenInfo } from "@/lib/actions/api-tokens";
import { Section } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Callout, shortDate } from "@/components/settings/bits";

const noopSubscribe = () => () => {};

function Endpoint({ method, label, code, note }: { method: "GET" | "POST"; label: string; code: string; note?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone={method === "GET" ? "sky" : "violet"} className="font-mono">{method}</Badge>
        <span className="text-[13px] font-medium text-neutral-800">{label}</span>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-neutral-50 px-3.5 py-3 font-mono text-xs leading-relaxed text-neutral-700 ring-1 ring-inset ring-neutral-200/80">{code}</pre>
      {note && <p className="mt-1.5 text-xs text-neutral-500">{note}</p>}
    </div>
  );
}

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

  // Server render uses a placeholder; the client swaps in its real origin after hydration (no mismatch).
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "https://your-app.example.com");
  const shownToken = freshToken ?? "<your-api-token>";

  return (
    <div className="space-y-5">
      <Section
        title="Workspace token"
        description="One shared token per workspace. It's stored hashed, so it can only be shown right after it's generated."
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-neutral-50 px-3 ring-1 ring-inset ring-neutral-200">
              <Key className="h-4 w-4 shrink-0 text-neutral-400" weight="duotone" />
              <code className="truncate font-mono text-[13px] text-neutral-900">
                {freshToken ?? (info.exists ? `${info.prefix ?? "lg_"}••••••••••••••••` : "No token yet")}
              </code>
              {info.exists && !freshToken && <Badge className="ml-auto">Hidden</Badge>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {freshToken && (
                <Button size="md" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" weight="bold" /> : <Copy className="h-4 w-4" weight="bold" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
              <Button size="md" variant={info.exists ? "secondary" : "primary"} onClick={generate} disabled={working}>
                <ArrowsClockwise className={`h-4 w-4 ${working ? "animate-spin" : ""}`} weight="bold" />
                {info.exists ? "Regenerate" : "Generate"}
              </Button>
            </div>
          </div>

          {freshToken ? (
            <Callout tone="warning" role="status">Copy this token now — it is stored hashed and will not be shown again.</Callout>
          ) : (
            <p className="text-xs leading-relaxed text-neutral-500">
              Lost it? Regenerate — the old one stops working immediately.
            </p>
          )}

          {info.exists && (
            <dl className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3 text-xs">
              <div>
                <dt className="text-neutral-400">Created</dt>
                <dd className="mt-0.5 text-neutral-700">{info.createdAt ? shortDate(info.createdAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400">Last used</dt>
                <dd className="mt-0.5 text-neutral-700">{info.lastUsedAt ? new Date(info.lastUsedAt).toLocaleString() : "Never"}</dd>
              </div>
            </dl>
          )}
          {error && <Callout>{error}</Callout>}
        </div>
      </Section>

      <Section title="Extension API" description="The two endpoints the LinkedIn Chrome extension calls with this token.">
        <div className="space-y-5">
          <Endpoint
            method="GET"
            label="Fetch queued LinkedIn messages"
            code={`GET ${origin}/api/extension/queue\nAuthorization: Bearer ${shownToken}`}
            note={
              <>
                Returns queued items: <code className="font-mono text-neutral-600">id, body, lead_name, linkedin_url, company, job_title, campaign_name</code>.
              </>
            }
          />
          <Endpoint
            method="POST"
            label="Report a message as sent or failed"
            code={`POST ${origin}/api/extension/queue\nAuthorization: Bearer ${shownToken}\nContent-Type: application/json\n\n{ "id": 123, "status": "sent" }`}
          />
        </div>
      </Section>
    </div>
  );
}
