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
      <div className="flex items-center gap-2 mb-6 border-b border-neutral-200">
        {(["domains", "mailboxes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 pb-3 -mb-px text-sm font-semibold transition-colors border-b-2 capitalize",
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
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
