"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react/ssr";
import type { DomainRecordView } from "@/lib/actions/domains";
import Badge from "@/components/ui/Badge";
import { statusMeta } from "./status";

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className="group/copy flex min-w-0 items-start gap-1.5">
      <code className="min-w-0 break-all font-mono text-[11px] leading-relaxed text-neutral-700">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy value"
        title="Copy"
        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 opacity-0 transition hover:bg-neutral-200/70 hover:text-neutral-800 focus-visible:opacity-100 group-hover/copy:opacity-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-600" weight="bold" /> : <Copy className="h-3 w-3" weight="bold" />}
      </button>
    </div>
  );
}

/** The DNS records Resend asked for, shown under an expanded domain row. */
export default function DnsRecordsTable({ records }: { records: DomainRecordView[] }) {
  if (records.length === 0) return <p className="px-5 py-4 text-xs text-neutral-500">No DNS records returned for this domain yet — refresh to fetch them.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] text-neutral-400">
            <th className="py-2 pl-5 pr-3 font-medium md:pl-12">Record</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">TTL</th>
            <th className="py-2 pl-3 pr-5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200/60">
          {records.map((r, i) => {
            const s = statusMeta(r.status);
            return (
              <tr key={i} className="align-top">
                <td className="py-2.5 pl-5 pr-3 font-medium text-neutral-900 md:pl-12">{r.record}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">{r.type}</span>
                </td>
                <td className="max-w-[180px] px-3 py-2.5"><CopyValue value={r.name} /></td>
                <td className="max-w-xs px-3 py-2.5"><CopyValue value={r.value} /></td>
                <td className="px-3 py-2.5 text-neutral-500">{r.ttl}</td>
                <td className="py-2.5 pl-3 pr-5"><Badge tone={s.tone} dot>{s.label}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
