"use client";

import { useState } from "react";
import { Check, CircleNotch, WarningCircle } from "@phosphor-icons/react/ssr";
import type { PublicForm } from "@/lib/forms-core";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { Input, Label } from "@/components/ui/Field";

export default function HostedFormClient({ embedKey, form }: { embedKey: string; form: PublicForm }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentGiven) {
      setError("Please accept the consent statement to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const url = new URL(window.location.href);
    try {
      const res = await fetch(`/api/forms/${embedKey}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fields: values,
          consentGiven,
          _hp: honeypot,
          pageUrl: window.location.href,
          utm: {
            source: url.searchParams.get("utm_source") ?? undefined,
            medium: url.searchParams.get("utm_medium") ?? undefined,
            campaign: url.searchParams.get("utm_campaign") ?? undefined,
            term: url.searchParams.get("utm_term") ?? undefined,
            content: url.searchParams.get("utm_content") ?? undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setDone(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center" role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/70">
          <Check className="h-6 w-6" weight="bold" />
        </span>
        <p className="mt-4 text-[17px] font-semibold tracking-tight text-neutral-950">Thanks — we&apos;ve got it.</p>
        <p className="mt-1 text-sm text-neutral-500">Someone from our team will be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="border-b border-neutral-100 px-6 pb-5 pt-6">
        <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-neutral-950">{form.name}</h1>
      </div>

      <div className="space-y-4 px-6 py-5">
        {/* Honeypot: hidden from real visitors, bots often fill every input. */}
        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-px w-px opacity-0"
          onChange={(e) => setHoneypot(e.target.value)}
        />

        {form.fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`f-${f.key}`}>
              {f.label}
              {f.required && <span className="text-rose-500"> *</span>}
            </Label>
            <Input
              id={`f-${f.key}`}
              type={f.type}
              required={f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>
        ))}

        <label htmlFor="f-consent" className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600 ring-1 ring-inset ring-neutral-200/70">
          <Checkbox id="f-consent" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-px" />
          <span>{form.consentText}</span>
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200/70">
            <WarningCircle className="mt-px h-4 w-4 shrink-0" weight="fill" />
            {error}
          </p>
        )}
      </div>

      <div className="px-6 pb-6">
        <Button type="submit" variant="primary" disabled={submitting} className="h-10 w-full text-sm">
          {submitting && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />}
          Submit
        </Button>
      </div>
    </form>
  );
}
