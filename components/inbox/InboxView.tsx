"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/ssr";
import type { Submission, FormDefinition } from "@/lib/actions/forms";
import type { Lead } from "@/lib/actions/leads";
import type { Member } from "@/lib/actions/workspace";
import Button from "@/components/ui/Button";
import { Segmented } from "@/components/ui/NavTabs";
import SubmissionsPanel from "./SubmissionsPanel";
import FormsPanel from "./FormsPanel";
import NewFormModal from "./NewFormModal";

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
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 px-4 py-2.5 md:px-6">
        <Segmented<Tab>
          options={[
            { value: "inbox", label: `Unmatched Inbox (${submissions.length})` },
            { value: "forms", label: `Forms (${forms.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "forms" && canManage && (
          <Button variant="primary" className="ml-auto" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" weight="bold" />
            New form
          </Button>
        )}
      </div>

      {tab === "inbox" ? (
        <SubmissionsPanel submissions={submissions} leads={leads} members={members} canManage={canManage} canApprove={canApprove} />
      ) : (
        <FormsPanel forms={forms} canManage={canManage} onNew={() => setNewOpen(true)} />
      )}

      {newOpen && <NewFormModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
