import { CheckCircle, Clock, XCircle } from "@phosphor-icons/react/ssr";
import { EXCLUSION_LABEL, type ExclusionReason } from "@/lib/domain/campaigns/types";
import type { CampaignDetail } from "@/lib/domain/campaigns/read-model";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatWhen } from "../builder/ui";

type Payload = {
  totalLeads?: number;
  exclusions?: Partial<Record<ExclusionReason, number>>;
  sampleMessage?: { leadName: string; subject: string; body: string } | null;
  warnings?: string[];
  steps?: { order: number }[];
  fromEmail?: string | null;
};

/** What the approver is asked to sign off on — and, afterwards, who decided and when. */
export default function ApprovalSummary({ approval }: { approval: NonNullable<CampaignDetail["approval"]> }) {
  const p = approval.payload as Payload;
  const exclusions = Object.entries(p.exclusions ?? {}).filter(([, n]) => (n ?? 0) > 0) as [ExclusionReason, number][];
  const state =
    approval.status === "pending"
      ? { tone: "violet" as const, icon: Clock, text: `Requested by ${approval.requestedBy ?? "someone"} — waiting for an owner or admin` }
      : approval.status === "approved"
        ? { tone: "emerald" as const, icon: CheckCircle, text: `Approved by ${approval.decidedBy ?? "—"} · ${formatWhen(approval.decidedAt)}` }
        : { tone: "rose" as const, icon: XCircle, text: `Rejected by ${approval.decidedBy ?? "—"} · ${formatWhen(approval.decidedAt)}` };
  const Icon = state.icon;
  return (
    <Card>
      <CardHeader title="Launch approval" description={`${p.totalLeads ?? 0} lead(s), ${p.steps?.length ?? 0} email(s)${p.fromEmail ? `, from ${p.fromEmail}` : ""}`} action={<Badge tone={state.tone} dot>{approval.status}</Badge>} />
      <div className="space-y-3 p-4 text-[13px]">
        <p className="flex items-center gap-1.5 text-neutral-600"><Icon className="h-4 w-4 shrink-0" weight="duotone" />{state.text}</p>
        {approval.note && <p className="rounded-lg bg-neutral-50 px-3 py-2 text-neutral-700 ring-1 ring-inset ring-neutral-200/80">“{approval.note}”</p>}
        {exclusions.length > 0 && <p className="text-xs text-neutral-500">Excluded before approval: {exclusions.map(([r, n]) => `${EXCLUSION_LABEL[r]} (${n})`).join(" · ")}</p>}
        {p.sampleMessage && (
          <div className="rounded-lg ring-1 ring-inset ring-neutral-200/80">
            <p className="border-b border-neutral-100 px-3.5 py-2 text-xs text-neutral-500">Sample — first email to {p.sampleMessage.leadName}</p>
            <div className="px-3.5 py-2.5">
              <p className="font-medium text-neutral-900">{p.sampleMessage.subject}</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-neutral-700">{p.sampleMessage.body}</p>
            </div>
          </div>
        )}
        {(p.warnings?.length ?? 0) > 0 && <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">{p.warnings!.slice(0, 5).map((w) => <li key={w}>{w}</li>)}</ul>}
      </div>
    </Card>
  );
}
