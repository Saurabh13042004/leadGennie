"use client";

import { useState } from "react";
import { CheckCircle, ShieldCheck, XCircle } from "@phosphor-icons/react/ssr";
import { approveExtensionConnection, denyExtensionConnection } from "@/lib/actions/extension";
import type { ConnectParams } from "@/lib/domain/extension/auth-service";
import { SCOPE_LABEL, type ExtensionScope } from "@/lib/extension/scopes";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Help, Input, Label } from "@/components/ui/Field";
import { Callout, Spinner } from "@/components/settings/bits";

/** Consent card: who is connecting, what it may do, what it may not — then Approve or Cancel. */
export default function ConnectConsent({
  params, user, workspaceName, role, scopes,
}: {
  params: ConnectParams;
  user: { name: string; email: string };
  workspaceName: string;
  role: string;
  scopes: ExtensionScope[];
}) {
  const [device, setDevice] = useState(params.device ?? "");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "approve" | "deny") {
    setBusy(kind);
    setError(null);
    const payload = { ...params, device: device.trim() || undefined };
    const res = kind === "approve" ? await approveExtensionConnection(payload) : await denyExtensionConnection(payload);
    if (!res.ok) {
      setError(res.error.message);
      setBusy(null);
      return;
    }
    // Hands control back to the extension (its auth window intercepts this address).
    window.location.assign(res.data.redirectTo);
  }

  return (
    <Card>
      <div className="space-y-5 p-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">Connect the LeadGennie extension</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            The extension will be able to act as you in this workspace. Only approve this if you just started it from your own browser.
          </p>
        </div>

        <div className="rounded-lg bg-neutral-50 px-3.5 py-3 ring-1 ring-inset ring-neutral-200/80">
          <p className="text-[13px] font-medium text-neutral-900">{user.name || user.email}</p>
          <p className="text-xs text-neutral-500">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="indigo">{workspaceName}</Badge>
            <Badge tone="neutral">{role}</Badge>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-neutral-800">It will be able to</p>
          <ul className="space-y-1.5">
            {scopes.map((s) => (
              <li key={s} className="flex items-start gap-2 text-[13px] text-neutral-700">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" weight="fill" />
                {SCOPE_LABEL[s]}
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" weight="duotone" />
            It can&apos;t send email, change settings, manage members, or see billing. You can disconnect it any time from Settings → Browser extension.
          </p>
        </div>

        <div>
          <Label htmlFor="device" hint="Shown in Settings">This browser is called</Label>
          <Input id="device" value={device} onChange={(e) => setDevice(e.target.value)} maxLength={80} placeholder="Chrome on my laptop" />
          <Help>Helps you recognise it if you ever need to disconnect it.</Help>
        </div>

        {error && <Callout tone="error">{error}</Callout>}

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="md" onClick={() => decide("deny")} disabled={busy !== null}>
            {busy === "deny" ? <Spinner /> : <XCircle className="h-4 w-4" weight="bold" />} Cancel
          </Button>
          <Button variant="primary" size="md" onClick={() => decide("approve")} disabled={busy !== null}>
            {busy === "approve" ? <Spinner /> : <CheckCircle className="h-4 w-4" weight="bold" />} Approve &amp; connect
          </Button>
        </div>
      </div>
    </Card>
  );
}
