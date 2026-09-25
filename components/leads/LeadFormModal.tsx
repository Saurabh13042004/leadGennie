"use client";

import { useState, type ReactNode } from "react";
import { CircleNotch, UserPlus, UserGear, WarningOctagon } from "@phosphor-icons/react/ssr";
import { createLead, updateLead, type Lead, type LeadInput } from "@/lib/actions/leads";
import type { LeadListRow } from "@/lib/db/leads-list";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import CompanyField from "./CompanyField";
import Modal from "@/components/ui/Modal";

const STAGES = ["new", "outreached", "engaged"];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs font-medium text-neutral-500">{title}</legend>
      {children}
    </fieldset>
  );
}

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
    <Modal
      title={lead ? "Edit lead" : "Add lead"}
      description={lead ? lead.full_name : "Add a single person by hand — or import a CSV for many."}
      icon={lead ? UserGear : UserPlus}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="lead-form" disabled={saving}>
            {saving && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />}
            {lead ? "Save changes" : "Add lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
        <Group title="Contact">
          <div>
            <Label htmlFor="lead-name">Full name</Label>
            <Input id="lead-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" autoFocus />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
            </div>
            <div>
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </Group>

        <Group title="Company & role">
          <CompanyField
            company={company}
            domain={companyDomain}
            onChange={(v) => { setCompany(v.company); setCompanyDomain(v.domain); }}
          />
          <div>
            <Label htmlFor="lead-title">Job title</Label>
            <Input id="lead-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
        </Group>

        <Group title="Other">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div>
              <Label htmlFor="lead-linkedin">LinkedIn URL</Label>
              <Input id="lead-linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <Label htmlFor="lead-stage">Stage</Label>
              <Select id="lead-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
            </div>
          </div>
        </Group>

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
            <WarningOctagon className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
