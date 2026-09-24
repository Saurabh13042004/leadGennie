"use client";

import Link from "next/link";
import { Loader2, Rocket } from "lucide-react";
import type { CampaignDraft } from "./useCampaignDraft";

export default function ReviewStep({ draft }: { draft: CampaignDraft }) {
  const {
    audience,
    channels,
    steps,
    totalDays,
    dailyEmailLimit,
    setDailyEmailLimit,
    dailyDmLimit,
    setDailyDmLimit,
    mailboxes,
    mailboxId,
    setMailboxId,
    error,
    launching,
    launch,
    setStep,
  } = draft;

  if (!audience) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white mb-1">Ready to submit for approval</h3>
      <p className="text-xs text-neutral-500 -mt-3">
        An owner or admin will review the audience and a sample message before anything sends.
      </p>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] divide-y divide-white/5">
        {[
          ["Audience", `${audience.name} (${audience.leadCount.toLocaleString()})`],
          ["Channels", channels],
          ["Steps", `${steps.length} touchpoints over ${totalDays} days`],
          ["Daily limit", `${dailyEmailLimit} emails / ${dailyDmLimit} DMs`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-neutral-500">{label}</span>
            <span className="text-sm text-white text-right">{value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">From mailbox</label>
          {mailboxes.length === 0 ? (
            <p className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              No active, verified mailbox yet.{" "}
              <Link href="/dashboard/deliverability" className="underline hover:text-yellow-100">
                Add one in Email Deliverability
              </Link>
              .
            </p>
          ) : (
            <select
              value={mailboxId ?? ""}
              onChange={(e) => setMailboxId(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email}
                </option>
              ))}
            </select>
          )}
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-between">
        <button
          onClick={() => setStep(2)}
          className="text-sm text-neutral-400 hover:text-white border border-white/10 rounded-lg px-4 py-2.5 transition-colors"
        >
          Back
        </button>
        <button
          onClick={launch}
          disabled={launching || !mailboxId}
          className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          Submit for approval
        </button>
      </div>
    </div>
  );
}
