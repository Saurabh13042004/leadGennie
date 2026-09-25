"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPrompt } from "@/lib/actions/prompts";
import { PROMPT_TYPES, type PromptType } from "@/lib/prompts-constants";
import Button from "@/components/ui/Button";
import { Help, Input, Label, Select } from "@/components/ui/Field";
import Modal from "@/components/settings/Modal";
import { Callout, Spinner } from "@/components/settings/bits";
import { TYPE_LABEL } from "./meta";

export default function NewPromptModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<PromptType>("email");
  const [channel, setChannel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await createPrompt({ name, type, channel: channel.trim() || undefined });
      router.push(`/dashboard/ai-prompts/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create prompt");
      setCreating(false);
    }
  }

  return (
    <Modal
      title="New prompt"
      description="Starts as a draft. Test it, then submit it for approval before it can be published."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-prompt-form" variant="primary" disabled={creating}>
            {creating && <Spinner className="h-3.5 w-3.5" />}
            Create draft
          </Button>
        </>
      }
    >
      <form id="new-prompt-form" onSubmit={handleSubmit} className="space-y-4 px-5 pb-5 pt-3">
        <div>
          <Label htmlFor="prompt-name">Name</Label>
          <Input id="prompt-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="First cold email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prompt-type">Type</Label>
            <Select id="prompt-type" value={type} onChange={(e) => setType(e.target.value as PromptType)}>
              {PROMPT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="prompt-channel" hint="Optional">Channel</Label>
            <Input id="prompt-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="e.g. email, linkedin_dm" />
          </div>
        </div>
        <Help className="mt-0">You can edit the template, input fields and output schema on the next screen.</Help>
        {error && <Callout>{error}</Callout>}
      </form>
    </Modal>
  );
}
