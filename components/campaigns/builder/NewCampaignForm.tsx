"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, FlowArrow } from "@phosphor-icons/react/ssr";
import { createCampaignDraft } from "@/lib/actions/campaign-builder";
import type { WorkflowSummary } from "@/lib/actions/workflows";
import { cn } from "@/lib/utils";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Help, Input, Label } from "@/components/ui/Field";
import { Notice } from "./ui";

/** Step zero: a name (and optionally a saved workflow to start from). Everything else happens in the builder. */
export default function NewCampaignForm({ workflows }: { workflows: WorkflowSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createCampaignDraft({ name, workflowId });
      if (!res.ok) return setError(res.error.message);
      router.push(`/dashboard/campaigns/${res.data.id}/edit`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="p-5">
        <Label htmlFor="new-name">Campaign name</Label>
        <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Q4 — Heads of Growth, B2B SaaS" autoFocus required />
        <Help>Only your team sees this. Nothing is sent from a draft — you&apos;ll pick the audience, write the emails, preview them and get approval first.</Help>
      </Card>

      {workflows.length > 0 && (
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-1.5"><FlowArrow className="h-4 w-4 text-indigo-600" weight="duotone" />Start from a saved workflow</span>}
            description="Its email steps become the sequence (LinkedIn steps are skipped — campaigns are email-only). Otherwise you get the default 4-email cadence."
            action={workflowId !== null && <Button variant="ghost" size="xs" onClick={() => setWorkflowId(null)}>Clear</Button>}
          />
          <div className="flex flex-wrap gap-2 p-4">
            {workflows.map((w) => {
              const on = workflowId === w.id;
              return (
                <button key={w.id} type="button" onClick={() => setWorkflowId(on ? null : w.id)}
                  className={cn("inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] ring-1 ring-inset transition-colors", on ? "bg-indigo-50 text-indigo-800 ring-indigo-300" : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300")}>
                  {w.name}
                  <span className={cn("text-xs tabular-nums", on ? "text-indigo-500" : "text-neutral-400")}>{w.stepCount} step{w.stepCount === 1 ? "" : "s"}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />} Create draft <ArrowRight className="h-4 w-4" weight="bold" />
        </Button>
      </div>
    </form>
  );
}
