"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AudienceOption } from "@/lib/actions/campaigns";
import { createCampaign } from "@/lib/actions/campaigns";
import { generateSequenceStepMessage } from "@/lib/actions/ai";
import { updateSenderPitch } from "@/lib/actions/profile";
import type { Mailbox } from "@/lib/actions/mailboxes";
import type { Channel } from "@/lib/ai/messages";
import { getWorkflow, type WorkflowSummary } from "@/lib/actions/workflows";
import { DEFAULT_STEPS, type SequenceStep } from "./types";

export type CampaignDraft = ReturnType<typeof useCampaignDraft>;

/** All wizard state + handlers. Step components are presentational over this. */
export function useCampaignDraft({
  audiences,
  initialPitch,
  mailboxes,
  workflows,
}: {
  audiences: AudienceOption[];
  initialPitch: string;
  mailboxes: Mailbox[];
  workflows: WorkflowSummary[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [audienceIdx, setAudienceIdx] = useState<number | null>(audiences.length > 0 ? 0 : null);
  const [pitch, setPitch] = useState(initialPitch);
  const [savingPitch, setSavingPitch] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS);
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
      setSteps(
        wf.steps.map((s) => ({
          channel: s.channel as Channel,
          waitDays: s.waitDays,
          subject: s.subject ?? undefined,
          body: s.body,
        }))
      );
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
    setSteps(DEFAULT_STEPS);
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
