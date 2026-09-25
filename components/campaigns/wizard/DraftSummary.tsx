import type { ReactNode } from "react";
import type { CampaignDraft } from "./useCampaignDraft";

/** Live recap of the draft in the builder's side rail (large screens only). */
export default function DraftSummary({ draft }: { draft: CampaignDraft }) {
  const { name, audience, steps, totalDays, channels } = draft;
  return (
    <div className="mt-8 hidden border-t border-neutral-200/80 pt-5 lg:block">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">This campaign</p>
      <dl className="space-y-3">
        <Row label="Name">{name.trim() || audience?.name || <Muted>Untitled</Muted>}</Row>
        <Row label="Audience">
          {audience ? (
            <>
              {audience.name}
              <span className="text-neutral-400"> · {audience.leadCount.toLocaleString()} leads</span>
            </>
          ) : (
            <Muted>Not selected</Muted>
          )}
        </Row>
        <Row label="Sequence">
          {steps.length} step{steps.length === 1 ? "" : "s"}
          <span className="text-neutral-400"> · {totalDays} days</span>
        </Row>
        <Row label="Channels">{channels || <Muted>None</Muted>}</Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-neutral-800">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-neutral-400">{children}</span>;
}
