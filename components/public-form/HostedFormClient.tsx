"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { PublicForm } from "@/lib/forms-core";

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
      <div className="flex flex-col items-center text-center py-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mb-3" />
        <p className="text-white font-medium">Thanks — we&apos;ve got it.</p>
        <p className="text-sm text-neutral-500 mt-1">Someone from our team will be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-lg font-semibold text-white">{form.name}</h1>

      {/* Honeypot: hidden from real visitors, bots often fill every input. */}
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] w-px h-px opacity-0"
        onChange={(e) => setHoneypot(e.target.value)}
      />

      {form.fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm text-neutral-300 mb-1.5">
            {f.label}
            {f.required && <span className="text-red-400"> *</span>}
          </label>
          <input
            type={f.type}
            required={f.required}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
      ))}

      <label className="flex items-start gap-2.5 text-xs text-neutral-400">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => setConsentGiven(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-blue-500 shrink-0"
        />
        <span>{form.consentText}</span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit
      </button>
    </form>
  );
}
