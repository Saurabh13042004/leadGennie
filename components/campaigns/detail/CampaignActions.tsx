"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleNotch, Pause, PencilSimple, Play, Prohibit, RocketLaunch, X } from "@phosphor-icons/react/ssr";
import { changeCampaignState, decideCampaignLaunch, launchCampaignAction } from "@/lib/actions/campaign-builder";
import { canTransition } from "@/lib/domain/campaigns/state-machine";
import type { CampaignStatus, SendModel } from "@/lib/domain/campaigns/types";
import Button, { buttonClasses } from "@/components/ui/Button";

/** Header actions for a campaign — only those the state machine allows (the server enforces it again). */
export default function CampaignActions({
  id, status, sendModel, approvalId, approvalPending, canEdit, canApprove,
}: {
  id: number;
  status: CampaignStatus;
  sendModel: SendModel;
  approvalId: number | null;
  approvalPending: boolean;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(key: string, work: () => Promise<{ ok: boolean; error?: { message: string } }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setError(null);
    setBusy(key);
    start(async () => {
      const res = await work();
      setBusy(null);
      if (!res.ok) return setError(res.error?.message ?? "Something went wrong.");
      router.refresh();
    });
  }
  const spin = (key: string) => busy === key && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />;

  if (!canEdit) return null;
  const builder = sendModel === "leads";
  const building = status === "draft" || status === "rejected";
  return (
    <>
      {error && <span role="alert" className="max-w-xs truncate text-xs text-rose-600" title={error}>{error}</span>}
      {builder && (building || status === "ready" || status === "running" || status === "paused") && (
        <Link href={`/dashboard/campaigns/${id}/edit`} className={buttonClasses({ variant: building ? "primary" : "secondary" })}>
          <PencilSimple className="h-4 w-4" weight="bold" /> {building ? "Continue building" : "Edit copy"}
        </Link>
      )}
      {status === "pending_approval" && approvalPending && approvalId && canApprove && (
        <>
          <Button variant="danger" disabled={pending} onClick={() => run("reject", () => decideCampaignLaunch(approvalId, "rejected", prompt("Why? (shown to the requester)") ?? undefined))}>
            {spin("reject") || <X className="h-4 w-4" weight="bold" />} Reject
          </Button>
          <Button variant="primary" disabled={pending} onClick={() => run("approve", () => decideCampaignLaunch(approvalId, "approved"))}>
            {spin("approve") || <Check className="h-4 w-4" weight="bold" />} Approve
          </Button>
        </>
      )}
      {canTransition(status, "canceled") && (
        <Button variant="ghost" disabled={pending} onClick={() => run("cancel", () => changeCampaignState(id, "cancel"), "Cancel this campaign? Every email not sent yet is dropped. This can't be undone.")}>
          {spin("cancel") || <Prohibit className="h-4 w-4" weight="bold" />} Cancel
        </Button>
      )}
      {canTransition(status, "paused") && (
        <Button variant="secondary" disabled={pending} onClick={() => run("pause", () => changeCampaignState(id, "pause"))}>
          {spin("pause") || <Pause className="h-4 w-4" weight="fill" />} Pause
        </Button>
      )}
      {status === "paused" && (
        <Button variant="primary" disabled={pending} onClick={() => run("resume", () => changeCampaignState(id, "resume"))}>
          {spin("resume") || <Play className="h-4 w-4" weight="fill" />} Resume
        </Button>
      )}
      {builder && status === "ready" && (
        <Button variant="accent" disabled={pending} onClick={() => run("launch", () => launchCampaignAction(id), "Launch now? Emails start going out on the schedule you set.")}>
          {spin("launch") || <RocketLaunch className="h-4 w-4" weight="fill" />} Launch
        </Button>
      )}
    </>
  );
}
