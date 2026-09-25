import type { AudienceResolution } from "./audience";
import type { DraftSummary, Readiness, Check } from "./readiness";
import type { CampaignRecord, ExclusionReason } from "./types";

/** Client-safe shapes (no lead lists beyond what the UI shows). Plain module: shared by actions and components. */

export type AudienceView = {
  candidates: number;
  eligible: number;
  exclusions: Record<ExclusionReason, number>;
  samples: Partial<Record<ExclusionReason, { id: number; name: string }[]>>;
  eligibleSample: { id: number; name: string; company: string | null }[];
  capped: boolean;
  notes: string[];
};

export type ReadinessView = {
  blockers: Check[];
  warnings: Check[];
  audience: AudienceView;
  mailbox: { email: string; dailyLimit: number; active: boolean; verified: boolean; provider?: string; blockedReason?: string | null } | null;
  drafts: DraftSummary;
  willEnroll: number;
  overTotalLimit: number;
};

/** `lockedStepIds`: steps that already went out to someone — their copy can't change. */
export type BuilderView = { campaign: CampaignRecord; readiness: ReadinessView; lockedStepIds: number[] };

export function toAudienceView(r: AudienceResolution): AudienceView {
  return {
    candidates: r.candidates, eligible: r.eligible.length, exclusions: r.exclusions, samples: r.samples,
    eligibleSample: r.eligible.slice(0, 8).map((l) => ({ id: l.id, name: l.fullName, company: l.company })),
    capped: r.capped, notes: r.notes,
  };
}

export function toReadinessView(r: Readiness): ReadinessView {
  return {
    blockers: r.blockers, warnings: r.warnings, audience: toAudienceView(r.audience),
    mailbox: r.mailbox ? { email: r.mailbox.email, dailyLimit: r.mailbox.dailyLimit, active: r.mailbox.active, verified: r.mailbox.verified, provider: r.mailbox.provider, blockedReason: r.mailbox.blockedReason } : null,
    drafts: r.drafts, willEnroll: r.willEnroll, overTotalLimit: r.overTotalLimit,
  };
}
