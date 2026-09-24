"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { createForm } from "@/lib/actions/forms";

export default function NewFormModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [consentText, setConsentText] = useState(
    "I agree to be contacted about this inquiry and understand my information will be processed per the privacy policy."
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createForm({ name, consentText });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create form");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-neutral-900 font-semibold">New form</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-neutral-700 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Website contact form"
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-700 mb-1.5">Consent statement</label>
            <textarea
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              Stored verbatim with every submission, versioned (FORM-01) — captures full name, work email, and
              company by default.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
          )}
          <button
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Create form
          </button>
        </form>
      </div>
    </div>
  );
}
