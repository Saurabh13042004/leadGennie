"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { createPrompt } from "@/lib/actions/prompts";
import { PROMPT_TYPES, type PromptType } from "@/lib/prompts-constants";

const TYPE_LABEL: Record<PromptType, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  sms: "SMS",
  cold_call: "Cold call script",
  research: "Research",
  qualification: "Qualification",
  classification: "Classification",
  extraction: "Extraction",
  summarization: "Summarization",
};

export default function NewPromptModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<PromptType>("email");
  const [channel, setChannel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await createPrompt({ name, type, channel: channel.trim() || undefined });
      router.push(`/dashboard/ai-prompts/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create prompt");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-neutral-900 font-semibold">New prompt</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="First cold email"
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PromptType)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              {PROMPT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Channel (optional)</label>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="e.g. email, linkedin_dm"
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create draft
          </button>
        </form>
      </div>
    </div>
  );
}
