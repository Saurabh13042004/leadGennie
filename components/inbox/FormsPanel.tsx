"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, CaretDown, Check, CircleNotch, Code, Copy, Pause, Play, Plus, ShareNetwork, Textbox } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { toggleFormStatus, type FormDefinition } from "@/lib/actions/forms";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import type { NavIcon } from "@/lib/nav-config";

function CopyRow({ icon: Icon, label, value, copied, onCopy }: { icon: NavIcon; label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <Icon className="h-3.5 w-3.5" weight="duotone" />
        {label}
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-neutral-700 ring-1 ring-inset ring-neutral-200">{value}</code>
        <Button variant="secondary" size="xs" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" weight="bold" /> : <Copy className="h-3.5 w-3.5" weight="bold" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default function FormsPanel({ forms, canManage, onNew }: { forms: FormDefinition[]; canManage: boolean; onNew: () => void }) {
  const router = useRouter();
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

  if (forms.length === 0) {
    return (
      <EmptyState
        icon={Textbox}
        title="No forms yet"
        description="Create a form to get a hosted link and embed snippet — submissions land in the Unmatched Inbox."
        actions={
          canManage ? (
            <Button variant="primary" onClick={onNew}>
              <Plus className="h-4 w-4" weight="bold" />
              New form
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-neutral-200/80 bg-neutral-50/60 text-left text-xs text-neutral-500">
            <th className="px-3 py-2 pl-4 font-medium md:pl-6">Form</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Submissions</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="w-40 pr-4 md:pr-6"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {forms.map((f) => {
            const hostedUrl = `${origin}/f/${f.embedKey}`;
            const embedSnippet = `<iframe src="${hostedUrl}" width="100%" height="480" style="border:none;"></iframe>`;
            const isBusy = busyId === f.id && isPending;
            const open = expandedId === f.id;
            return (
              <Fragment key={f.id}>
                <tr className={cn("group transition-colors", open ? "bg-neutral-50/80" : "hover:bg-neutral-50/80")}>
                  <td className="min-w-[220px] py-2.5 pl-4 pr-3 md:pl-6">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
                        <Textbox className="h-4 w-4" weight="duotone" />
                      </span>
                      <span className="truncate font-medium text-neutral-900">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={f.status === "active" ? "emerald" : "amber"} dot pulse={f.status === "active"} className="capitalize">{f.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                    {f.submissionCount} <span className="text-neutral-400">submission{f.submissionCount === 1 ? "" : "s"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="py-2.5 pl-2 pr-4 md:pr-6">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => toggle(f)}
                          disabled={isBusy}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-all hover:bg-neutral-100 hover:text-neutral-900 focus-visible:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                          aria-label={f.status === "active" ? "Pause" : "Activate"}
                          title={f.status === "active" ? "Pause" : "Activate"}
                        >
                          {isBusy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : f.status === "active" ? <Pause className="h-4 w-4" weight="fill" /> : <Play className="h-4 w-4" weight="fill" />}
                        </button>
                      )}
                      <Button variant={open ? "secondary" : "ghost"} size="xs" onClick={() => setExpandedId(open ? null : f.id)}>
                        <ShareNetwork className="h-3.5 w-3.5" weight="bold" />
                        {open ? "Hide" : "Share"}
                        <CaretDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} weight="bold" />
                      </Button>
                    </div>
                  </td>
                </tr>
                {open && (
                  <tr className="bg-neutral-50/80">
                    <td colSpan={5} className="px-4 pb-4 pt-1 md:px-6">
                      <div className="grid gap-3 md:grid-cols-2">
                        <CopyRow icon={ArrowSquareOut} label="Hosted link" value={hostedUrl} copied={copiedId === f.id * 2} onCopy={() => copy(hostedUrl, f.id * 2)} />
                        <CopyRow icon={Code} label="Embed snippet" value={embedSnippet} copied={copiedId === f.id * 2 + 1} onCopy={() => copy(embedSnippet, f.id * 2 + 1)} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
