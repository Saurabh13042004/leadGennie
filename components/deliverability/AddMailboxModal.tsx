"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { requestAddMailbox } from "@/lib/actions/mailboxes";
import type { Domain } from "@/lib/actions/domains";
import Button from "@/components/ui/Button";
import { Help, Input, Label, inputClasses } from "@/components/ui/Field";
import Modal from "@/components/settings/Modal";
import { Callout, Spinner } from "@/components/settings/bits";
import { cn } from "@/lib/utils";

export default function AddMailboxModal({ domains, onClose }: { domains: Domain[]; onClose: () => void }) {
  const router = useRouter();
  const [domainId, setDomainId] = useState<number | null>(domains[0]?.id ?? null);
  const [localPart, setLocalPart] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDomain = domains.find((d) => d.id === domainId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domainId || !selectedDomain) return;
    setCreating(true);
    setError(null);
    try {
      await requestAddMailbox({ email: `${localPart}@${selectedDomain.name}`, domainId, dailyLimit });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request mailbox");
      setCreating(false);
    }
  }

  return (
    <Modal
      title="Add mailbox"
      description="Adding a mailbox always requires owner/admin approval before it can send (DEL-02)."
      onClose={onClose}
      footer={
        domains.length === 0 ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="add-mailbox-form" variant="primary" disabled={creating}>
              {creating && <Spinner className="h-3.5 w-3.5" />}
              Request mailbox
            </Button>
          </>
        )
      }
    >
      {domains.length === 0 ? (
        <div className="px-5 pb-5 pt-3">
          <Callout tone="info">Add a sending domain first before adding a mailbox.</Callout>
        </div>
      ) : (
        <form id="add-mailbox-form" onSubmit={handleSubmit} className="space-y-4 px-5 pb-5 pt-3">
          <div>
            <Label htmlFor="mailbox-local">Address</Label>
            <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:border-neutral-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20">
              <input
                id="mailbox-local"
                autoFocus
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))}
                required
                placeholder="jane"
                className="min-w-0 flex-1 bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              <span className="flex items-center border-x border-neutral-200 bg-neutral-50 px-2 text-[13px] text-neutral-400">@</span>
              <div className="relative flex max-w-[60%]">
                <select
                  aria-label="Domain"
                  value={domainId ?? ""}
                  onChange={(e) => setDomainId(Number(e.target.value))}
                  className={cn(inputClasses, "h-full w-full min-w-0 cursor-pointer appearance-none truncate rounded-none pr-7 shadow-none ring-0 hover:ring-0 focus:ring-0")}
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <CaretDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" weight="bold" />
              </div>
            </div>
            {selectedDomain && selectedDomain.status !== "verified" && (
              <Callout tone="warning" className="mt-2 text-xs">
                This domain isn&apos;t verified yet — the mailbox can be approved, but won&apos;t be sendable until the domain verifies.
              </Callout>
            )}
          </div>
          <div>
            <Label htmlFor="mailbox-limit">Daily send limit</Label>
            <div className="flex items-center gap-2">
              <Input id="mailbox-limit" type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="w-28 tabular-nums" />
              <span className="text-xs text-neutral-400">emails / day</span>
            </div>
            <Help>Start low while the mailbox warms up; you can request an increase later.</Help>
          </div>
          {error && <Callout>{error}</Callout>}
        </form>
      )}
    </Modal>
  );
}
