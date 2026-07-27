"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { retryFailedGroup, type FailedSendGroup } from "@/lib/actions/brief";

export default function FailedSendsCard({
  groups,
  canRetry,
}: {
  groups: FailedSendGroup[];
  canRetry: boolean;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = groups.filter((g) => !resolved.has(`${g.campaignId}:${g.errorMessage}`));
  if (visible.length === 0) return null;

  function handleRetry(group: FailedSendGroup) {
    const key = `${group.campaignId}:${group.errorMessage}`;
    setPendingKey(key);
    startTransition(async () => {
      await retryFailedGroup(group.campaignId, group.sendIds);
      setResolved((prev) => new Set(prev).add(key));
      setPendingKey(null);
    });
  }

  const total = visible.reduce((acc, g) => acc + g.count, 0);

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-red-500/20">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300 font-medium">
          {total} send{total === 1 ? "" : "s"} failed and need attention
        </p>
      </div>
      <div className="divide-y divide-red-500/10">
        {visible.map((g) => {
          const key = `${g.campaignId}:${g.errorMessage}`;
          const busy = isPending && pendingKey === key;
          return (
            <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href="/dashboard/campaigns"
                  className="text-sm text-white hover:underline truncate block"
                >
                  {g.campaignName}
                </Link>
                <p className="text-xs text-red-300/80 truncate">
                  {g.count}× — {g.errorMessage}
                </p>
              </div>
              {canRetry && (
                <button
                  onClick={() => handleRetry(g)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 shrink-0"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
