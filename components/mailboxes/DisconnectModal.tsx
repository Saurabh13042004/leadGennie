"use client";

import { useState } from "react";
import { disconnectMailbox } from "@/lib/actions/mailboxes";
import type { Mailbox } from "@/lib/domain/mailboxes/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Callout, Spinner } from "@/components/settings/bits";

/** Confirmation before disconnecting. It says exactly what happens — including how many running campaigns will stop. */
export default function DisconnectModal({ mailbox, onClose, onDone }: { mailbox: Mailbox; onClose: () => void; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await disconnectMailbox(mailbox.id);
    if (!res.ok) {
      setError(res.error.message);
      setBusy(false);
      return;
    }
    const { campaignsPaused } = res.data;
    onDone(`Disconnected ${mailbox.email}.${campaignsPaused ? ` ${campaignsPaused} running campaign${campaignsPaused === 1 ? " was" : "s were"} paused.` : ""}`);
  }

  const n = mailbox.activeCampaigns;
  return (
    <Modal
      title={`Disconnect ${mailbox.email}?`}
      size="md"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>{busy && <Spinner />} Disconnect</Button>
        </>
      }
    >
      <div className="space-y-3 px-5 pb-5 pt-3 text-[13px] leading-relaxed text-neutral-600">
        <p>LeadGennie will stop sending from this mailbox and delete its saved sign-in{mailbox.provider === "gmail" ? ", and revoke its access at Google" : ""}.</p>
        {mailbox.provider === "microsoft" && <p>Microsoft doesn&apos;t let apps revoke themselves — to remove LeadGennie completely, also remove it at myapps.microsoft.com.</p>}
        {n > 0 ? (
          <Callout tone="warning">{n} running campaign{n === 1 ? " uses" : "s use"} this mailbox. {n === 1 ? "It" : "They"} will be paused and can be resumed after you pick another mailbox.</Callout>
        ) : (
          <p>No running campaigns use this mailbox.</p>
        )}
        <p>Your sent emails, conversations and campaign analytics are kept.</p>
        {error && <Callout>{error}</Callout>}
      </div>
    </Modal>
  );
}
