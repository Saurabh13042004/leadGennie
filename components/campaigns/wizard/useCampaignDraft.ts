"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AudienceOption } from "@/lib/actions/campaigns";
import { createCampaign } from "@/lib/actions/campaigns";
import { createCampaignFromWizard } from "@/lib/actions/campaign-builder";
import { generateSequenceStepMessage } from "@/lib/actions/ai";
import { updateSenderPitch } from "@/lib/actions/profile";
import type { Mailbox } from "@/lib/actions/mailboxes";
import type { Channel } from "@/lib/ai/messages";
import { getWorkflow, type WorkflowSummary } from "@/lib/actions/workflows";
import { DEFAULT_EMAIL_STEPS, DEFAULT_STEPS, type SequenceStep } from "./types";

export type CampaignDraft = ReturnType<typeof useCampaignDraft>;

/** All wizard state + handlers. Step components are presentational over this. */
export function useCampaignDraft({
  audiences,
  initialPitch,
  mailboxes,
  workflows,
  multichannel = false,
}: {
  audiences: AudienceOption[];
  initialPitch: string;
  mailboxes: Mailbox[];
  workflows: WorkflowSummary[];
  /** D-05: LinkedIn DM steps only when FEATURE_LINKEDIN_AUTOMATION is on. Otherwise the wizard is email-only. */
  multichannel?: boolean;
}) {
  const defaultSteps = multichannel ? DEFAULT_STEPS : DEFAULT_EMAIL_STEPS;
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [audienceIdx, setAudienceIdx] = useState<number | null>(audiences.length > 0 ? 0 : null);
  const [pitch, setPitch] = useState(initialPitch);
  const [savingPitch, setSavingPitch] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>(defaultSteps);
  const [mailboxId, setMailboxId] = useState<number | null>(mailboxes[0]?.id ?? null);
  const [dailyEmailLimit, setDailyEmailLimit] = useState(80);
  const [dailyDmLimit, setDailyDmLimit] = useState(25);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoadingIdx, setAiLoadingIdx] = useState<Set<number>>(new Set());
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  const audience = audienceIdx !== null ? audiences[audienceIdx] : null;

  const channels = useMemo(() => {
    const set = new Set(steps.map((s) => (s.channel === "email" ? "Email" : "LinkedIn")));
    return Array.from(set).join(" + ");
  }, [steps]);

  const totalDays = steps.reduce((acc, s) => acc + s.waitDays, 0);

  async function applyWorkflow(id: number) {
    setWorkflowLoading(true);
    setError(null);
    try {
      const wf = await getWorkflow(id);
      const matchedIdx =
        wf.sourceType === "segment"
          ? audiences.findIndex((a) => a.id === wf.sourceSegmentId)
          : audiences.findIndex((a) => a.id === null);
      if (matchedIdx >= 0) setAudienceIdx(matchedIdx);
      const all = wf.steps.map((s) => ({ channel: s.channel as Channel, waitDays: s.waitDays, subject: s.subject ?? undefined, body: s.body }));
      // Email-only: LinkedIn steps are dropped and their wait folds into the next email.
      let carry = 0;
      const emailOnly: SequenceStep[] = [];
      for (const s of all) {
        if (s.channel !== "email") {
          carry += s.waitDays;
          continue;
        }
        emailOnly.push({ ...s, waitDays: s.waitDays + carry });
        carry = 0;
      }
      setSteps(multichannel ? all : emailOnly.length > 0 ? emailOnly.map((s, i) => (i === 0 ? { ...s, waitDays: 0 } : s)) : defaultSteps);
      setWorkflowId(id);
      if (!name.trim()) setName(workflows.find((w) => w.id === id)?.name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workflow");
    } finally {
      setWorkflowLoading(false);
    }
  }

  function clearWorkflow() {
    setWorkflowId(null);
    setSteps(defaultSteps);
  }

  function updateStep(idx: number, patch: Partial<SequenceStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function writeStep(idx: number, channel: Channel) {
    setAiLoadingIdx((prev) => new Set(prev).add(idx));
    try {
      const draft = await generateSequenceStepMessage({
        channel,
        stepIndex: idx,
        audienceLabel: audience?.name ?? "your target audience",
        audiencePrompt: audience?.prompt ?? null,
        campaignName: name || audience?.name,
      });
      updateStep(idx, draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate AI draft");
    } finally {
      setAiLoadingIdx((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  useEffect(() => {
    if (step !== 2) return;
    steps.forEach((s, idx) => {
      if (!s.body.trim()) writeStep(idx, s.channel);
    });
    // Only auto-draft once when the sequence step is first shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function addStep() {
    const newIdx = steps.length;
    setSteps((prev) => [...prev, { channel: "email", waitDays: 3, subject: "", body: "" }]);
    writeStep(newIdx, "email");
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  async function continueFromAudience() {
    setSavingPitch(true);
    try {
      await updateSenderPitch(pitch);
    } finally {
      setSavingPitch(false);
    }
    setStep(2);
  }

  async function launch() {
    if (!audience || !mailboxId) return;
    setLaunching(true);
    setError(null);
    try {
      if (!multichannel) {
        // Email-only: becomes a campaign with the full Phase 4 lifecycle (approval gate, exclusions, preview, launch).
        const res = await createCampaignFromWizard({
          name: name || audience.name,
          audienceSegmentId: audience.id,
          mailboxId,
          dailyLimit: dailyEmailLimit,
          steps: steps.map((s) => ({ waitDays: s.waitDays, subject: s.subject, body: s.body })),
          workflowId,
        });
        if (!res.ok) throw new Error(res.error.message);
        router.push(res.data.submitted ? `/dashboard/campaigns/${res.data.id}` : `/dashboard/campaigns/${res.data.id}/edit`);
        router.refresh();
        return;
      }
      const result = await createCampaign({
        name: name || audience.name,
        audienceLabel: audience.name,
        audienceSegmentId: audience.id,
        totalLeads: audience.leadCount,
        channels: steps.map((s) => s.channel),
        mailboxId,
        dailyEmailLimit,
        dailyDmLimit,
        steps: steps.map((s) => ({ channel: s.channel, waitDays: s.waitDays, subject: s.subject, body: s.body })),
        workflowId,
      });
      const params = new URLSearchParams({ launched: String(result.id) });
      if (result.blockedCount > 0) params.set("blocked", String(result.blockedCount));
      router.push(`/dashboard/campaigns?${params.toString()}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not launch campaign");
      setLaunching(false);
    }
  }

  return {
    // inputs
    audiences,
    multichannel,
    mailboxes,
    workflows,
    // state
    step,
    setStep,
    name,
    setName,
    audienceIdx,
    setAudienceIdx,
    audience,
    pitch,
    setPitch,
    savingPitch,
    steps,
    mailboxId,
    setMailboxId,
    dailyEmailLimit,
    setDailyEmailLimit,
    dailyDmLimit,
    setDailyDmLimit,
    launching,
    error,
    aiLoadingIdx,
    workflowId,
    workflowLoading,
    // derived
    channels,
    totalDays,
    // actions
    applyWorkflow,
    clearWorkflow,
    updateStep,
    writeStep,
    addStep,
    removeStep,
    continueFromAudience,
    launch,
  };
}
