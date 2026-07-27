"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/actions/domains";
import type { Mailbox } from "@/lib/actions/mailboxes";
import DomainsPanel from "./DomainsPanel";
import MailboxesPanel from "./MailboxesPanel";

type Tab = "domains" | "mailboxes";

export default function DeliverabilityView({
  domains,
  mailboxes,
  canAddDomain,
  canAddMailbox,
  canManage,
  canApprove,
}: {
  domains: Domain[];
  mailboxes: Mailbox[];
  canAddDomain: boolean;
  canAddMailbox: boolean;
  canManage: boolean;
  canApprove: boolean;
}) {
  const [tab, setTab] = useState<Tab>("domains");

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        {(["domains", "mailboxes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border capitalize",
              tab === t
                ? "bg-blue-500/10 border-blue-500/30 text-white"
                : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "domains" ? (
        <DomainsPanel domains={domains} canAdd={canAddDomain} canManage={canManage} />
      ) : (
        <MailboxesPanel
          mailboxes={mailboxes}
          domains={domains}
          canAdd={canAddMailbox}
          canManage={canManage}
          canApprove={canApprove}
        />
      )}
    </div>
  );
}
