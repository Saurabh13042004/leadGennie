"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Channel } from "@/lib/ai/messages";
import type { CampaignDraft } from "./useCampaignDraft";

export default function SequenceEditor({ draft }: { draft: CampaignDraft }) {
  const { steps, aiLoadingIdx, addStep, removeStep, updateStep, writeStep, setStep } = draft;

  return (
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
  );
}
