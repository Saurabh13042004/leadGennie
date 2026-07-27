"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Submission, FormDefinition } from "@/lib/actions/forms";
import type { Lead } from "@/lib/actions/leads";
import type { Member } from "@/lib/actions/workspace";
import SubmissionsPanel from "./SubmissionsPanel";
import FormsPanel from "./FormsPanel";

type Tab = "inbox" | "forms";

export default function InboxView({
  submissions,
  forms,
  leads,
  members,
  canManage,
  canApprove,
}: {
  submissions: Submission[];
  forms: FormDefinition[];
  leads: Lead[];
  members: Member[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const [tab, setTab] = useState<Tab>("inbox");

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        {(
          [
            ["inbox", `Unmatched Inbox (${submissions.length})`],
            ["forms", `Forms (${forms.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              tab === t
                ? "bg-blue-500/10 border-blue-500/30 text-white"
                : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "inbox" ? (
        <SubmissionsPanel submissions={submissions} leads={leads} members={members} canManage={canManage} canApprove={canApprove} />
      ) : (
        <FormsPanel forms={forms} canManage={canManage} />
      )}
    </div>
  );
}
