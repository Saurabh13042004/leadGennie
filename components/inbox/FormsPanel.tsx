"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Code, ExternalLink, Pause, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFormStatus, type FormDefinition } from "@/lib/actions/forms";
import NewFormModal from "./NewFormModal";

export default function FormsPanel({ forms, canManage }: { forms: FormDefinition[]; canManage: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function toggle(form: FormDefinition) {
    setBusyId(form.id);
    startTransition(async () => {
      await toggleFormStatus(form.id, form.status === "active" ? "paused" : "active");
      router.refresh();
      setBusyId(null);
    });
  }

  function copy(text: string, id: number) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <div className="flex justify-end mb-4">
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New form
          </button>
        )}
      </div>

      {forms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-neutral-900 font-semibold">No forms yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Create a form to get a hosted link and embed snippet — submissions land in the Unmatched Inbox.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => {
            const hostedUrl = `${origin}/f/${f.embedKey}`;
            const embedSnippet = `<iframe src="${hostedUrl}" width="100%" height="480" style="border:none;"></iframe>`;
            const isBusy = busyId === f.id && isPending;
            return (
              <div key={f.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{f.name}</p>
                    <p className="text-xs text-neutral-500">
                      {f.submissionCount} submission{f.submissionCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium rounded-full px-2.5 py-1",
                        f.status === "active"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                      )}
                    >
                      {f.status}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => toggle(f)}
                        disabled={isBusy}
                        className="text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
                        aria-label={f.status === "active" ? "Pause" : "Activate"}
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : f.status === "active" ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {expandedId === f.id ? "Hide" : "Share"}
                    </button>
                  </div>
                </div>

                {expandedId === f.id && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 space-y-3">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1.5">
                        <ExternalLink className="w-3 h-3" />
                        Hosted link
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 truncate">
                          {hostedUrl}
                        </code>
                        <button
                          onClick={() => copy(hostedUrl, f.id * 2)}
                          className="text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedId === f.id * 2 && <span className="text-xs text-emerald-600 shrink-0">Copied</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1.5">
                        <Code className="w-3 h-3" />
                        Embed snippet
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 truncate">
                          {embedSnippet}
                        </code>
                        <button
                          onClick={() => copy(embedSnippet, f.id * 2 + 1)}
                          className="text-neutral-500 hover:text-neutral-900 transition-colors shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedId === f.id * 2 + 1 && <span className="text-xs text-emerald-600 shrink-0">Copied</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <NewFormModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
