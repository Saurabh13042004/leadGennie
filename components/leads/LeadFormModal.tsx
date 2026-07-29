"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createLead, updateLead, type Lead, type LeadInput } from "@/lib/actions/leads";

const STAGES = ["new", "outreached", "engaged"];

export default function LeadFormModal({
  lead,
  onClose,
  onSaved,
}: {
  lead?: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const [fullName, setFullName] = useState(lead?.full_name ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [company, setCompany] = useState(lead?.company ?? "");
  const [jobTitle, setJobTitle] = useState(lead?.job_title ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(lead?.linkedin_url ?? "");
  const [stage, setStage] = useState(lead?.stage ?? "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: LeadInput = {
      full_name: fullName,
      email: email || undefined,
      company: company || undefined,
      job_title: jobTitle || undefined,
      linkedin_url: linkedinUrl || undefined,
      stage,
    };

    try {
      const saved = lead ? await updateLead(lead.id, input) : await createLead(input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lead");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold">{lead ? "Edit lead" : "Add lead"}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Company</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">LinkedIn URL</label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {lead ? "Save changes" : "Add lead"}
          </button>
        </form>
      </div>
    </div>
  );
}
