"use client";

import { useState, useTransition } from "react";
import { CheckCircle } from "@phosphor-icons/react/ssr";
import { saveSenderIdentityAction } from "@/lib/actions/sending";
import type { SenderIdentity } from "@/lib/campaigns/render";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Help, Input, Label, Textarea } from "@/components/ui/Field";
import { Callout, Spinner } from "./bits";

/** Who is sending and where they are — printed in the footer of every email (required for launch). */
export default function SenderIdentitySetting({ initial, canEdit }: { initial: SenderIdentity; canEdit: boolean }) {
  const [name, setName] = useState(initial.name ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const missing = !initial.name?.trim() || !initial.address?.trim();

  function save() {
    setMessage(null);
    start(async () => {
      const res = await saveSenderIdentityAction({ name, address });
      setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error.message });
    });
  }

  return (
    <Section
      title={<span id="identity-heading">Sender identity</span>}
      description="Anti-spam law (CAN-SPAM, GDPR) requires every marketing email to say who sent it and where they are. This goes in each email's footer, above the unsubscribe link."
    >
      <div className="space-y-4">
        {missing && <Callout tone="warning">Campaigns can&apos;t launch until both fields are filled in.</Callout>}
        <div>
          <Label htmlFor="sender-name">Sender name</Label>
          <Input id="sender-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit || pending} maxLength={120} placeholder="Leadgennie Solutions" />
        </div>
        <div>
          <Label htmlFor="sender-address">Postal address</Label>
          <Textarea id="sender-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit || pending} rows={2} maxLength={300} placeholder="221B Baker Street, London NW1 6XE, United Kingdom" className="resize-none" />
          <Help>A real mailing address for your business (a PO box or registered agent address is fine).</Help>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={save} disabled={pending}>{pending && <Spinner />} Save</Button>
            {message && (
              <span role="status" className={message.ok ? "inline-flex items-center gap-1.5 text-[13px] text-emerald-700" : "text-[13px] text-rose-600"}>
                {message.ok && <CheckCircle className="h-4 w-4" weight="fill" />}{message.text}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-neutral-500">Only workspace owners and admins can change this.</p>
        )}
      </div>
    </Section>
  );
}
