"use client";

import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { createDeal, recommendDealForLead, type Stage } from "@/lib/actions/deals";
import type { Lead } from "@/lib/actions/leads";

export default function NewDealModal({
  stages,
  leads,
  defaultStageId,
  onClose,
  onCreated,
}: {
  stages: Stage[];
  leads: Lead[];
  defaultStageId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState<string>("");
  const [name, setName] = useState("");
  const [value, setValue] = useState(5000);
  const [probability, setProbability] = useState(30);
  const [accountCompany, setAccountCompany] = useState("");
  const [stageId, setStageId] = useState(defaultStageId);
  const [source, setSource] = useState<"manual" | "ai_recommended">("manual");
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    if (!leadId) {
      setError("Pick a lead first so there's something to base a suggestion on.");
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      const rec = await recommendDealForLead(Number(leadId));
      setName(rec.name);
      setValue(rec.value);
      setProbability(rec.probability);
      setAccountCompany(rec.accountCompany ?? "");
      setSource("ai_recommended");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a suggestion");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the deal a name.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createDeal({
        name: name.trim(),
        value,
        probability,
        stageId,
        leadId: leadId ? Number(leadId) : null,
        accountCompany: accountCompany.trim() || null,
        source,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create deal");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold">New deal</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Related lead (optional)</label>
            <div className="flex gap-2">
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="">No lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                    {l.company ? ` — ${l.company}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting || !leadId}
                className="flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 border border-blue-500/30 rounded-lg px-3 py-2 transition-colors disabled:opacity-40 shrink-0"
              >
                {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Suggest
              </button>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1">
              &quot;Suggest&quot; only fills the fields below — nothing is created until you submit.
            </p>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Deal name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSource("manual");
              }}
              placeholder="e.g. Acme Inc — Series B expansion"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Value ($)</label>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Probability (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(Number(e.target.value))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Account / company</label>
            <input
              value={accountCompany}
              onChange={(e) => setAccountCompany(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Stage</label>
            <select
              value={stageId}
              onChange={(e) => setStageId(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create deal
          </button>
        </form>
      </div>
    </div>
  );
}
