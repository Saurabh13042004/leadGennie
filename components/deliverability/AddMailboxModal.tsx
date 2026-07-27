"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { requestAddMailbox } from "@/lib/actions/mailboxes";
import type { Domain } from "@/lib/actions/domains";

export default function AddMailboxModal({ domains, onClose }: { domains: Domain[]; onClose: () => void }) {
  const router = useRouter();
  const [domainId, setDomainId] = useState<number | null>(domains[0]?.id ?? null);
  const [localPart, setLocalPart] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDomain = domains.find((d) => d.id === domainId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domainId || !selectedDomain) return;
    setCreating(true);
    setError(null);
    try {
      await requestAddMailbox({ email: `${localPart}@${selectedDomain.name}`, domainId, dailyLimit });
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request mailbox");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold">Add mailbox</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {domains.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-neutral-400">Add a sending domain first before adding a mailbox.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Address</label>
              <div className="flex items-center gap-2">
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ""))}
                  required
                  placeholder="jane"
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <span className="text-sm text-neutral-500">@</span>
                <select
                  value={domainId ?? ""}
                  onChange={(e) => setDomainId(Number(e.target.value))}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedDomain && selectedDomain.status !== "verified" && (
                <p className="text-xs text-yellow-400/80 mt-1.5">
                  This domain isn&apos;t verified yet — the mailbox can be approved, but won&apos;t be sendable until
                  the domain verifies.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1.5">Daily send limit</label>
              <input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <p className="text-xs text-neutral-600">
              Adding a mailbox always requires owner/admin approval before it can send (DEL-02).
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Request mailbox
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
