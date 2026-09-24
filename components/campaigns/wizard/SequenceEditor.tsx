"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { Channel } from "@/lib/ai/messages";
import type { CampaignDraft } from "./useCampaignDraft";

export default function SequenceEditor({ draft }: { draft: CampaignDraft }) {
  const { steps, aiLoadingIdx, addStep, removeStep, updateStep, writeStep, setStep } = draft;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Sequence steps</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Each step sends automatically after its wait period.</p>
        </div>
        <button
          onClick={addStep}
          className="flex items-center gap-1.5 text-sm text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add step
        </button>
      </div>

      {steps.map((s, idx) => (
        <div key={idx} className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                {idx + 1}
              </div>
              <select
                value={s.channel}
                onChange={(e) => updateStep(idx, { channel: e.target.value as Channel })}
                className="bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              >
                <option value="email">Email</option>
                <option value="linkedin_dm">LinkedIn DM</option>
              </select>
              <span className="text-xs text-neutral-500">
                {idx === 0 ? "Send immediately" : `Wait ${s.waitDays} days`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => writeStep(idx, s.channel)}
                disabled={aiLoadingIdx.has(idx)}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
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
                  className="text-neutral-400 hover:text-rose-600 transition-colors"
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
                className="w-16 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
              <span className="text-xs text-neutral-500">days</span>
            </div>
          )}

          {s.channel === "email" && (
            <input
              value={s.subject ?? ""}
              onChange={(e) => updateStep(idx, { subject: e.target.value })}
              placeholder="Subject line"
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          )}

          <textarea
            value={s.body}
            onChange={(e) => updateStep(idx, { body: e.target.value })}
            rows={s.channel === "email" ? 5 : 3}
            placeholder={aiLoadingIdx.has(idx) ? "Generating with AI…" : "Write a message or click AI write"}
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
          />
        </div>
      ))}

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep(1)}
          className="text-sm text-neutral-600 hover:text-neutral-900 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(3)}
          className="bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
