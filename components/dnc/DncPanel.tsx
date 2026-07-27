"use client";

import { useState, useTransition } from "react";
import { UserX, Loader2, Trash2 } from "lucide-react";
import { addDncEntry, removeDncEntry, type DncEntry } from "@/lib/actions/dnc";

export default function DncPanel({
  initialEntries,
  canManage,
}: {
  initialEntries: DncEntry[];
  canManage: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startAdd(async () => {
      try {
        await addDncEntry(email, reason);
        setEntries((prev) => [
          { id: -Date.now(), email: email.trim().toLowerCase(), reason: reason.trim() || null, source: "manual", createdAt: new Date().toISOString() },
          ...prev,
        ]);
        setEmail("");
        setReason("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add entry");
      }
    });
  }

  async function handleRemove(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await removeDncEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove entry");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 flex flex-col sm:flex-row gap-2 items-start sm:items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-sm text-neutral-300 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@company.com"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm text-neutral-300 mb-1.5">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Asked not to be contacted"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 shrink-0"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
          Add
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-16 px-6">
          <p className="text-white font-medium">No suppressions yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Anyone added here is excluded from every campaign — checked at enrollment and again immediately before
            each send.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                  {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{entry.email}</td>
                    <td className="px-4 py-3 text-neutral-400">{entry.reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-neutral-300 border border-white/10 rounded-full px-2.5 py-1">
                        {entry.source === "unsubscribe_link" ? "Unsubscribe link" : "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemove(entry.id)}
                          disabled={busyId === entry.id}
                          className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label="Remove"
                        >
                          {busyId === entry.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
