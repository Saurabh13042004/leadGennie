import { isFreeMailDomain } from "@/lib/domain/leads/email";
import { isWindowOpen, nextLocalDayStart, nextWindowOpen } from "@/lib/domain/campaigns/schedule";
import type { SendWindow } from "@/lib/domain/campaigns/types";

/**
 * SendGate (WP5.3): every "may this email go out RIGHT NOW?" rule in one pure module. It decides; it does not touch the
 * database. The caller loads the counts, asks the gate, and — for the hard caps — the claim statement re-verifies them
 * atomically (lib/domain/sending/claim.ts), so two workers can never both spend the last slot.
 *
 * Order matters and is fixed: window → campaign daily → mailbox daily (with warm-up ramp) → workspace cap →
 * recipient-domain throttle → spacing. The first rule that says "not now" wins and tells the caller WHEN to retry.
 */

export type SendGateConfig = {
  /** Base gap between two sends from one mailbox; the actual gap is jittered ±50% so sends never form a burst. */
  spacingSeconds: number;
  /** Max emails per hour to one recipient domain (free-mail domains like gmail.com are exempt — they're many companies). */
  domainHourlyLimit: number;
  /** Warm-up: a new mailbox sends at most `rampBase * rampGrowth^days` per day until it reaches its configured limit. */
  rampBase: number;
  rampGrowth: number;
};

export const DEFAULT_GATE_CONFIG: SendGateConfig = { spacingSeconds: 20, domainHourlyLimit: 10, rampBase: 15, rampGrowth: 1.5 };

/** Overrides from the environment (SEND_SPACING_SECONDS, SEND_DOMAIN_HOURLY_LIMIT) — read once per send, never trusted blindly. */
export function gateConfigFromEnv(env: Record<string, string | undefined> = process.env): SendGateConfig {
  const num = (v: string | undefined, d: number, min: number) => {
    const n = Number(v);
    return v !== undefined && v !== "" && Number.isFinite(n) && n >= min ? n : d;
  };
  return {
    ...DEFAULT_GATE_CONFIG,
    spacingSeconds: num(env.SEND_SPACING_SECONDS, DEFAULT_GATE_CONFIG.spacingSeconds, 0),
    domainHourlyLimit: num(env.SEND_DOMAIN_HOURLY_LIMIT, DEFAULT_GATE_CONFIG.domainHourlyLimit, 1),
  };
}

/** Effective daily limit of a mailbox: its configured limit, capped by the warm-up ramp for its age in days. */
export function effectiveMailboxLimit(dailyLimit: number, mailboxCreatedAt: Date, now: Date, cfg: SendGateConfig = DEFAULT_GATE_CONFIG): number {
  const days = Math.max(0, Math.floor((now.getTime() - mailboxCreatedAt.getTime()) / 86_400_000));
  const ramp = Math.round(cfg.rampBase * cfg.rampGrowth ** Math.min(days, 60));
  return Math.max(1, Math.min(dailyLimit, ramp));
}

/** Deterministic jitter in [0.5, 1.5) from a stable seed (the send id) — spread without randomness that tests can't pin. */
export function jitterFactor(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return 0.5 + (x - Math.floor(x));
}

export type GateInput = {
  now: Date;
  /** null = no window (legacy campaigns keep sending whenever they're due, exactly as before). */
  window: SendWindow | null;
  /** Timezone for "today" of the campaign's own daily limit. */
  campaignTimezone: string;
  campaignDailyLimit: number;
  mailboxDailyLimit: number;
  mailboxCreatedAt: Date;
  workspaceDailyCap: number | null;
  recipientDomain: string;
  counts: {
    campaignToday: number;
    mailboxToday: number;
    workspaceToday: number;
    domainLastHour: number;
    /** Claim time of the most recent send from this mailbox (any campaign). */
    mailboxLastClaimAt: Date | null;
  };
  /** Seed for the spacing jitter (the campaign_send id). */
  seed: number;
  config?: SendGateConfig;
};

export type GateReason = "outside_window" | "campaign_daily_limit" | "mailbox_daily_limit" | "workspace_daily_cap" | "domain_throttle" | "spacing";

export type GateDecision = { kind: "send"; limits: { campaign: number; mailbox: number; workspace: number | null; domainHourly: number | null; spacingSeconds: number } } | { kind: "defer"; until: Date; reason: GateReason; detail: string };

const UTC = "UTC";

export function evaluateGate(input: GateInput): GateDecision {
  const cfg = input.config ?? DEFAULT_GATE_CONFIG;
  const { now, counts } = input;

  if (input.window && !isWindowOpen(now, input.window)) {
    return { kind: "defer", until: nextWindowOpen(now, input.window), reason: "outside_window", detail: "Outside the campaign's send window" };
  }
  if (counts.campaignToday >= input.campaignDailyLimit) {
    return { kind: "defer", until: nextLocalDayStart(now, input.campaignTimezone), reason: "campaign_daily_limit", detail: `Campaign daily limit of ${input.campaignDailyLimit} reached` };
  }
  const mailboxLimit = effectiveMailboxLimit(input.mailboxDailyLimit, input.mailboxCreatedAt, now, cfg);
  if (counts.mailboxToday >= mailboxLimit) {
    const warming = mailboxLimit < input.mailboxDailyLimit;
    return { kind: "defer", until: nextLocalDayStart(now, UTC), reason: "mailbox_daily_limit", detail: warming ? `Mailbox is warming up: ${mailboxLimit}/day for now` : `Mailbox daily limit of ${mailboxLimit} reached` };
  }
  if (input.workspaceDailyCap !== null && counts.workspaceToday >= input.workspaceDailyCap) {
    return { kind: "defer", until: nextLocalDayStart(now, UTC), reason: "workspace_daily_cap", detail: `Workspace daily cap of ${input.workspaceDailyCap} reached` };
  }
  const throttled = !isFreeMailDomain(input.recipientDomain);
  if (throttled && counts.domainLastHour >= cfg.domainHourlyLimit) {
    return { kind: "defer", until: new Date(now.getTime() + 10 * 60_000), reason: "domain_throttle", detail: `Already sent ${cfg.domainHourlyLimit} to ${input.recipientDomain} in the last hour` };
  }
  const spacing = Math.round(cfg.spacingSeconds * jitterFactor(input.seed));
  if (counts.mailboxLastClaimAt && spacing > 0) {
    const next = counts.mailboxLastClaimAt.getTime() + spacing * 1000;
    if (now.getTime() < next) {
      // A little extra jitter on the wake-up so waiting sends don't all return in the same second.
      const wake = next + Math.round(jitterFactor(input.seed + 1) * 1000);
      return { kind: "defer", until: new Date(wake), reason: "spacing", detail: "Spacing sends out to avoid a burst" };
    }
  }
  return { kind: "send", limits: { campaign: input.campaignDailyLimit, mailbox: mailboxLimit, workspace: input.workspaceDailyCap, domainHourly: throttled ? cfg.domainHourlyLimit : null, spacingSeconds: spacing } };
}
