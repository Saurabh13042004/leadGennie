"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Trash2, Loader2 } from "lucide-react";
import { deleteLead, type Lead } from "@/lib/actions/leads";
import LeadFormModal from "./LeadFormModal";

const STAGE_STYLES: Record<string, string> = {
  new: "bg-white/5 text-neutral-300 border-white/10",
  outreached: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  engaged: "bg-green-500/10 text-green-300 border-green-500/20",
};

export default function LeadsTable({
  leads,
  canEdit,
  canDelete,
}: {
  leads: Lead[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(leads);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync when the server refetches (e.g. after router.refresh()).
  const [prevLeads, setPrevLeads] = useState(leads);
  if (leads !== prevLeads) {
    setPrevLeads(leads);
    setItems(leads);
  }

  function handleDelete(id: number) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteLead(id);
        setItems((prev) => prev.filter((l) => l.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete lead");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
        <p className="text-white font-medium">No leads yet</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          Import a CSV or add a lead above to start building your lead universe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Full name</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">LinkedIn</th>
                {(canEdit || canDelete) && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                        {lead.full_name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white">{lead.full_name}</p>
                        {lead.email && <p className="text-xs text-neutral-500">{lead.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{lead.company || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs border rounded-full px-2.5 py-1 ${STAGE_STYLES[lead.stage] ?? STAGE_STYLES.new}`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{lead.job_title || "—"}</td>
                  <td className="px-4 py-3">
                    {lead.linkedin_url ? (
                      <a
                        href={lead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Profile
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {canEdit && (
                          <button
                            onClick={() => setEditing(lead)}
                            className="text-neutral-500 hover:text-white transition-colors"
                            aria-label="Edit lead"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${lead.full_name}? This can't be undone.`)) handleDelete(lead.id);
                            }}
                            disabled={busyId === lead.id}
                            className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                            aria-label="Delete lead"
                          >
                            {busyId === lead.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <LeadFormModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
