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
        className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@company.com"
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Asked not to be contacted"
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 shrink-0"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
          Add
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-16 px-6">
          <p className="text-neutral-900 font-semibold">No suppressions yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Anyone added here is excluded from every campaign — checked at enrollment and again immediately before
            each send.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Added</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 text-neutral-900 font-medium">{entry.email}</td>
                    <td className="px-4 py-3 text-neutral-500">{entry.reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-neutral-600 bg-neutral-100 ring-1 ring-inset ring-neutral-200 rounded-full px-2.5 py-1">
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
                          className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
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
