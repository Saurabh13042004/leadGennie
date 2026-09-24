"use client";

import { useState } from "react";
import { X, Loader2, User, Mail as MailIcon, Briefcase, Phone as PhoneIcon, Link2, Flag } from "lucide-react";
import { createLead, updateLead, type Lead, type LeadInput } from "@/lib/actions/leads";
import type { LeadListRow } from "@/lib/db/leads-list";
import CompanyField from "./CompanyField";

const STAGES = ["new", "outreached", "engaged"];

const inputCls =
  "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";
const labelCls = "flex items-center gap-1.5 text-sm font-medium text-neutral-700 mb-1.5";

export default function LeadFormModal({
  lead,
  onClose,
  onSaved,
}: {
  lead?: LeadListRow;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}) {
  const [fullName, setFullName] = useState(lead?.full_name ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [company, setCompany] = useState(lead?.company_name ?? lead?.company ?? "");
  const [companyDomain, setCompanyDomain] = useState(lead?.company_domain ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
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
      company_domain: companyDomain || undefined,
      phone: phone || undefined,
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-base font-bold tracking-tight text-neutral-900">{lead ? "Edit lead" : "Add lead"}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Contact</p>
            <div>
              <label className={labelCls}><User className="w-3.5 h-3.5 text-neutral-400" /> Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}><MailIcon className="w-3.5 h-3.5 text-neutral-400" /> Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}><PhoneIcon className="w-3.5 h-3.5 text-neutral-400" /> Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Company &amp; role</p>
            <CompanyField
              company={company}
              domain={companyDomain}
              onChange={(v) => { setCompany(v.company); setCompanyDomain(v.domain); }}
            />
            <div>
              <label className={labelCls}><Briefcase className="w-3.5 h-3.5 text-neutral-400" /> Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Other</p>
            <div>
              <label className={labelCls}><Link2 className="w-3.5 h-3.5 text-neutral-400" /> LinkedIn URL</label>
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}><Flag className="w-3.5 h-3.5 text-neutral-400" /> Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className={inputCls}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {lead ? "Save changes" : "Add lead"}
          </button>
        </form>
      </div>
    </div>
  );
}
