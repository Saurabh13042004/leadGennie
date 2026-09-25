"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkBreak, PlugsConnected, Trash } from "@phosphor-icons/react/ssr";
import { revokeExtensionSession, type ExtensionSessionsView } from "@/lib/actions/extension";
import { SCOPE_SHORT, isExtensionScope } from "@/lib/extension/scopes";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader, Section } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Callout, IconButton, TD, TH, THEAD_ROW, timeAgo } from "@/components/settings/bits";

const STEPS = [
  "Install the LeadGennie extension (load the chrome-extension folder in chrome://extensions → Developer mode → Load unpacked).",
  "Click the LeadGennie icon and choose Connect. A window opens here; approve the connection.",
  "Open any prospect's page — a LinkedIn profile or a company site — and add them as a lead in two clicks.",
];

export default function ExtensionPanel({ view, automation }: { view: ExtensionSessionsView; automation: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function revoke(id: number, label: string) {
    if (!confirm(`Disconnect ${label}? The extension will be signed out immediately.`)) return;
    setBusyId(id);
    setError(null);
    start(async () => {
      const res = await revokeExtensionSession(id);
      if (!res.ok) setError(res.error.message);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Section title="Get connected" description="Three steps, about a minute.">
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-neutral-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600 ring-1 ring-inset ring-neutral-200">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {!automation && (
          <p className="mt-4 text-xs text-neutral-500">
            LinkedIn message automation is switched off for this deployment, so the extension only captures leads and starts research.
          </p>
        )}
      </Section>

      <Card>
        <CardHeader
          title="Connected browsers"
          description={view.canManageAll ? "Everyone in this workspace who has connected the extension." : "Browsers you have connected."}
        />
        {error && <div className="px-4 pt-3"><Callout tone="error">{error}</Callout></div>}
        {view.sessions.length === 0 ? (
          <EmptyState compact icon={PlugsConnected} title="No browsers connected yet" description="Once you connect the extension it will show up here, and you can disconnect it at any time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Browser</th>
                  {view.canManageAll && <th className={TH}>Person</th>}
                  <th className={TH}>Can</th>
                  <th className={TH}>Last used</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {view.sessions.map((s) => {
                  const label = s.deviceLabel || `Browser ${s.tokenPrefix}…`;
                  return (
                    <tr key={s.id}>
                      <td className={TD}>
                        <p className="font-medium text-neutral-900">{label}</p>
                        <p className="font-mono text-[11px] text-neutral-400">{s.tokenPrefix}…</p>
                      </td>
                      {view.canManageAll && (
                        <td className={TD}>
                          <p className="text-neutral-800">{s.userName}</p>
                          <p className="text-xs text-neutral-500">{s.userEmail}</p>
                        </td>
                      )}
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1">
                          {s.scopes.filter(isExtensionScope).map((sc) => (
                            <Badge key={sc} tone="neutral" className="font-normal">{SCOPE_SHORT[sc]}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-neutral-500`}>{s.lastUsedAt ? timeAgo(s.lastUsedAt) : "Never"}</td>
                      <td className={`${TD} text-right`}>
                        <IconButton icon={Trash} label={`Disconnect ${label}`} tone="danger" busy={busyId === s.id && pending} onClick={() => revoke(s.id, label)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
          <LinkBreak className="h-3.5 w-3.5" weight="duotone" />
          Disconnecting signs that browser out on its next request. Removing someone from the workspace also cuts their extension off.
        </div>
      </Card>
    </div>
  );
}
