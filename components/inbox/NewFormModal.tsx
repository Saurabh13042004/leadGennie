"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Textbox, WarningOctagon } from "@phosphor-icons/react/ssr";
import { createForm } from "@/lib/actions/forms";
import Button from "@/components/ui/Button";
import { Help, Input, Label, Textarea } from "@/components/ui/Field";
import Modal from "@/components/leads/Modal";

export default function NewFormModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [consentText, setConsentText] = useState(
    "I agree to be contacted about this inquiry and understand my information will be processed per the privacy policy."
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createForm({ name, consentText });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create form");
      setCreating(false);
    }
  }

  return (
    <Modal
      title="New form"
      description="Get a hosted link and embed snippet for inbound leads."
      icon={Textbox}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-form" disabled={creating}>
            {creating && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />}
            Create form
          </Button>
        </>
      }
    >
      <form id="new-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
        <div>
          <Label htmlFor="form-name">Name</Label>
          <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Website contact form" autoFocus />
        </div>
        <div>
          <Label htmlFor="form-consent">Consent statement</Label>
          <Textarea id="form-consent" value={consentText} onChange={(e) => setConsentText(e.target.value)} rows={3} className="resize-none" />
          <Help>
            Stored verbatim with every submission, versioned (FORM-01) — captures full name, work email, and company by default.
          </Help>
        </div>
        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            <WarningOctagon className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
