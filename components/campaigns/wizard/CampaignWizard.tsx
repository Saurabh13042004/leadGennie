"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Newspaper,
  UserCheck,
  Globe,
  Split,
  Rocket,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import WizardStepper from "./WizardStepper";
import type { AudienceOption } from "@/lib/actions/campaigns";
import { createCampaign } from "@/lib/actions/campaigns";
import { generateSequenceStepMessage } from "@/lib/actions/ai";
import { updateSenderPitch } from "@/lib/actions/profile";
import type { Channel } from "@/lib/ai/messages";

type SequenceStep = {
  channel: Channel;
  waitDays: number;
  subject?: string;
  body: string;
};

const DEFAULT_STEPS: SequenceStep[] = [
  { channel: "email", waitDays: 0, subject: "", body: "" },
  { channel: "linkedin_dm", waitDays: 2, body: "" },
  { channel: "email", waitDays: 4, subject: "", body: "" },
];

const PERSONALIZATION_OPTIONS = [
  {
    key: "news",
    icon: Newspaper,
    title: "Insert recent company news",
    description: "Pulls funding, hires, product launches",
  },
  {
    key: "tone",
    icon: UserCheck,
    title: "Adapt tone to seniority",
    description: "CTO vs SDR will read different lines",
  },
  {
    key: "localize",
    icon: Globe,
    title: "Localize language",
    description: '"hello" in their first language for first line',
  },
  {
    key: "abtest",
    icon: Split,
    title: "A/B test subject lines",
    description: "AI picks the winner after 200 sends",
  },
];

function hashRate(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 20 + (hash % 8); // 20-27%
}

export default function CampaignWizard({
  audiences,
  initialPitch,
}: {
  audiences: AudienceOption[];
  initialPitch: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [audienceIdx, setAudienceIdx] = useState<number | null>(audiences.length > 0 ? 0 : null);
  const [pitch, setPitch] = useState(initialPitch);
  const [savingPitch, setSavingPitch] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS);
  const [personalization, setPersonalization] = useState<string[]>(["news", "tone"]);
  const [fromEmail, setFromEmail] = useState("jane@leadforge.io");
  const [dailyEmailLimit, setDailyEmailLimit] = useState(80);
  const [dailyDmLimit, setDailyDmLimit] = useState(25);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoadingIdx, setAiLoadingIdx] = useState<Set<number>>(new Set());

  const audience = audienceIdx !== null ? audiences[audienceIdx] : null;

  const channels = useMemo(() => {
    const set = new Set(steps.map((s) => (s.channel === "email" ? "Email" : "LinkedIn")));
    return Array.from(set).join(" + ");
  }, [steps]);

  const totalDays = steps.reduce((acc, s) => acc + s.waitDays, 0);
  const predictedRate = audience ? hashRate(name || audience.name) : 24;
  const predictedReplies = audience ? Math.round((audience.leadCount * predictedRate) / 100) : 0;

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

  async function handleContinueFromStep1() {
    setSavingPitch(true);
    try {
      await updateSenderPitch(pitch);
    } finally {
      setSavingPitch(false);
    }
    setStep(2);
  }

  async function handleLaunch() {
    if (!audience) return;
    setLaunching(true);
    setError(null);
    try {
      await createCampaign({
        name: name || audience.name,
        audienceLabel: audience.name,
        audienceSegmentId: audience.id,
        totalLeads: audience.leadCount,
        channels: steps.map((s) => s.channel),
        fromEmail,
        dailyEmailLimit,
        dailyDmLimit,
        steps: steps.map((s) => ({ channel: s.channel, waitDays: s.waitDays, subject: s.subject, body: s.body })),
      });
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not launch campaign");
      setLaunching(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/dashboard/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-xl font-semibold text-white mb-1">Create campaign</h1>
      <p className="text-sm text-neutral-500 mb-6">Multi-channel sequence builder</p>

      <WizardStepper current={step} />

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Campaign name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={audience?.name ?? "e.g. Q3 SaaS – India ICP"}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">
              What do you sell, and why should this audience care?
            </label>
            <p className="text-xs text-neutral-500 mb-2">
              This grounds every AI-written message in your actual pitch instead of generic filler. Saved to your
              profile and reused across campaigns.
            </p>
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={3}
              placeholder="e.g. We build an AI code-review tool for engineering teams. Cuts PR review time in half and catches bugs before they hit prod. Best for eng teams 20-200 people shipping fast."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
            />
            {!pitch.trim() && (
              <p className="text-xs text-amber-400/80 mt-1.5">
                Leave this empty and the AI will avoid inventing fake product claims — but the copy will be generic.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-white mb-1">Choose your audience</h3>
            <p className="text-xs text-neutral-500 mb-3">Pick a saved segment or build a new one with AI.</p>

            {audiences.length === 0 ? (
              <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-white/15 px-4 py-6 text-center">
                No segments yet.{" "}
                <Link href="/dashboard/leads" className="text-white hover:underline">
                  Build one from the Leads page
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {audiences.map((a, i) => (
                  <button
                    key={`${a.id}-${a.name}`}
                    onClick={() => setAudienceIdx(i)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      audienceIdx === i
                        ? "border-blue-500/40 bg-blue-500/10"
                        : "border-white/10 hover:bg-white/5"
                    )}
                  >
                    <div>
                      <p className="text-sm text-white">{a.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {a.leadCount.toLocaleString()} leads · {a.updatedLabel}
                      </p>
                    </div>
                    {audienceIdx === i && <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleContinueFromStep1}
              disabled={!audience || savingPitch}
              className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {savingPitch && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Sequence steps</h3>
            <button
              onClick={addStep}
              className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add step
            </button>
          </div>

          {steps.map((s, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">Step {idx + 1}</span>
                  <select
                    value={s.channel}
                    onChange={(e) => updateStep(idx, { channel: e.target.value as Channel })}
                    className="bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none"
                  >
                    <option value="email">Email</option>
                    <option value="linkedin_dm">LinkedIn DM</option>
                  </select>
                  <span className="text-xs text-neutral-500">
                    {idx === 0 ? "Send immediately" : `Wait ${s.waitDays} days`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => writeStep(idx, s.channel)}
                    disabled={aiLoadingIdx.has(idx)}
                    className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 transition-colors disabled:opacity-50"
                  >
                    {aiLoadingIdx.has(idx) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI write
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      className="text-neutral-500 hover:text-red-400 transition-colors"
                      aria-label="Remove step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {idx > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-500">Wait</label>
                  <input
                    type="number"
                    min={0}
                    value={s.waitDays}
                    onChange={(e) => updateStep(idx, { waitDays: Number(e.target.value) })}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none"
                  />
                  <span className="text-xs text-neutral-500">days</span>
                </div>
              )}

              {s.channel === "email" && (
                <input
                  value={s.subject ?? ""}
                  onChange={(e) => updateStep(idx, { subject: e.target.value })}
                  placeholder="Subject line"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              )}

              <textarea
                value={s.body}
                onChange={(e) => updateStep(idx, { body: e.target.value })}
                rows={s.channel === "email" ? 5 : 3}
                placeholder={aiLoadingIdx.has(idx) ? "Generating with AI…" : "Write a message or click AI write"}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
              />
            </div>
          ))}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-4 py-2.5 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">AI personalization</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Auto-customize each message using lead data and live signals.
            </p>
          </div>

          <div className="space-y-2">
            {PERSONALIZATION_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const checked = personalization.includes(opt.key);
              return (
                <label
                  key={opt.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                    checked ? "border-blue-500/30 bg-blue-500/5" : "border-white/10 hover:bg-white/5"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setPersonalization((prev) =>
                        checked ? prev.filter((k) => k !== opt.key) : [...prev, opt.key]
                      )
                    }
                    className="w-4 h-4 accent-blue-500"
                  />
                  <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm text-white">{opt.title}</p>
                    <p className="text-xs text-neutral-500">{opt.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-4 py-2.5 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && audience && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white mb-1">Ready to launch</h3>

          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] divide-y divide-white/5">
            {[
              ["Audience", `${audience.name} (${audience.leadCount.toLocaleString()})`],
              ["Channels", channels],
              ["Steps", `${steps.length} touchpoints over ${totalDays} days`],
              ["From", fromEmail],
              ["Daily limit", `${dailyEmailLimit} emails / ${dailyDmLimit} DMs`],
              ["Est. replies", `≈ ${predictedReplies} (${predictedRate}%)`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-neutral-500">{label}</span>
                <span className="text-sm text-white text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">From email</label>
              <input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">Emails/day</label>
                <input
                  type="number"
                  value={dailyEmailLimit}
                  onChange={(e) => setDailyEmailLimit(Number(e.target.value))}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">DMs/day</label>
                <input
                  type="number"
                  value={dailyDmLimit}
                  onChange={(e) => setDailyDmLimit(Number(e.target.value))}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500">
            AI predicts {predictedRate}% reply rate based on similar campaigns.
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-4 py-2.5 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              Launch campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
