"use client";

import { useState, useTransition } from "react";
import { Prohibit, Trash, UserMinus } from "@phosphor-icons/react/ssr";
import { addDncEntry, removeDncEntry, type DncEntry } from "@/lib/actions/dnc";
import Card, { CardHeader, Section } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Label } from "@/components/ui/Field";
import { Callout, IconButton, Spinner, TD, TH, THEAD_ROW, shortDate } from "@/components/settings/bits";
import { cn } from "@/lib/utils";

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

  const unsubCount = entries.filter((e) => e.source === "unsubscribe_link").length;

  return (
    <div className="space-y-5">
      <Section title="Add an address" description="They're excluded from every campaign — checked at enrollment and again right before each send.">
        <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="dnc-email">Email</Label>
            <Input id="dnc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="dnc-reason" hint="Optional">Reason</Label>
            <Input id="dnc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Asked not to be contacted" />
          </div>
          <Button type="submit" variant="primary" size="md" disabled={adding}>
            {adding ? <Spinner /> : <UserMinus className="h-4 w-4" weight="bold" />}
            Add
          </Button>
        </form>
      </Section>

      {error && <Callout>{error}</Callout>}

      <Card className="overflow-hidden">
        <CardHeader
          title="Suppression list"
          description={
            entries.length === 0
              ? "Nobody is suppressed yet."
              : `${entries.length} address${entries.length === 1 ? "" : "es"}${unsubCount ? ` · ${unsubCount} from unsubscribe links` : ""}`
          }
        />
        {entries.length === 0 ? (
          <EmptyState
            compact
            icon={Prohibit}
            title="No suppressions yet"
            description="Anyone added here — or who clicks an unsubscribe link — is excluded from every campaign."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Email</th>
                  <th className={cn(TH, "hidden sm:table-cell")}>Reason</th>
                  <th className={TH}>Source</th>
                  <th className={cn(TH, "hidden md:table-cell")}>Added</th>
                  {canManage && <th className={cn(TH, "w-12")}><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="group transition-colors hover:bg-neutral-50/70">
                    <td className={cn(TD, "font-medium text-neutral-900")}>{entry.email}</td>
                    <td className={cn(TD, "hidden text-neutral-500 sm:table-cell")}>{entry.reason ?? <span className="text-neutral-300">—</span>}</td>
                    <td className={TD}>
                      {entry.source === "unsubscribe_link" ? <Badge tone="sky">Unsubscribe link</Badge> : <Badge>Manual</Badge>}
                    </td>
                    <td className={cn(TD, "hidden text-xs text-neutral-500 md:table-cell")}>{shortDate(entry.createdAt)}</td>
                    {canManage && (
                      <td className={cn(TD, "text-right")}>
                        <IconButton
                          icon={Trash}
                          label="Remove"
                          tone="danger"
                          busy={busyId === entry.id}
                          disabled={busyId === entry.id}
                          onClick={() => handleRemove(entry.id)}
                          className={cn("ml-auto md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100", busyId === entry.id && "md:opacity-100")}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
