"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDomain } from "@/lib/actions/domains";
import Button from "@/components/ui/Button";
import { Help, Input, Label } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { Callout, Spinner } from "@/components/settings/bits";

export default function AddDomainModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await addDomain(name);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add domain");
      setCreating(false);
    }
  }

  return (
    <Modal
      title="Add sending domain"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-domain-form" variant="primary" disabled={creating}>
            {creating && <Spinner className="h-3.5 w-3.5" />}
            Add domain
          </Button>
        </>
      }
    >
      <form id="add-domain-form" onSubmit={handleSubmit} className="space-y-4 px-5 pb-5 pt-3">
        <div>
          <Label htmlFor="domain-name">Domain</Label>
          <Input id="domain-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="example.com" />
          <Help>Registers with Resend and returns the exact SPF/DKIM/DMARC records to add at your DNS provider.</Help>
        </div>
        {error && <Callout>{error}</Callout>}
      </form>
    </Modal>
  );
}
