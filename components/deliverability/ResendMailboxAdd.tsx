"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import type { Domain } from "@/lib/actions/domains";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AddMailboxModal from "./AddMailboxModal";

/** Addresses on a verified domain send through Resend. They're listed and managed with every other mailbox under Mailboxes. */
export default function ResendMailboxAdd({ domains, existing, canAdd }: { domains: Domain[]; existing: number; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-neutral-900">Mailboxes on your domains</p>
        <p className="text-xs text-neutral-500">
          {existing === 0 ? "None yet." : `${existing} set up.`} New addresses need owner/admin approval; manage them under{" "}
          <Link href="/dashboard/deliverability" className="font-medium underline underline-offset-2">Mailboxes</Link>.
        </p>
      </div>
      {canAdd && (
        <Button size="xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" weight="bold" /> Add mailbox</Button>
      )}
      {open && <AddMailboxModal domains={domains} onClose={() => setOpen(false)} />}
    </Card>
  );
}
