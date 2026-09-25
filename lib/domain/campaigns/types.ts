import { z } from "zod";
import { TONES } from "@/lib/domain/personalization/types";

/** Every status a campaign can be in. The first four legacy values ('pending_approval', 'running', 'paused', 'rejected') predate the builder. */
export const CAMPAIGN_STATUSES = ["draft", "pending_approval", "ready", "running", "paused", "completed", "failed", "canceled", "rejected"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const SEND_MODELS = ["legacy", "leads"] as const;
export type SendModel = (typeof SEND_MODELS)[number];

export const STEP_MODES = ["template", "personalized"] as const;
export type StepMode = (typeof STEP_MODES)[number];

export const CAMPAIGN_LEAD_STATUSES = ["pending", "active", "replied", "completed", "stopped", "bounced", "unsubscribed", "blocked", "failed"] as const;
export type CampaignLeadStatus = (typeof CAMPAIGN_LEAD_STATUSES)[number];

/** Why a lead did not make it into the audience. Order = precedence: each lead is counted under its FIRST matching reason. */
export const EXCLUSION_REASONS = [
  "no_email",
  "invalid_email",
  // Suppressions outrank "risky": if someone unsubscribed or bounced, that is the fact the user needs to see.
  "do_not_contact",
  "unsubscribed",
  "bounced",
  "risky_email",
  "cooldown",
  "in_other_campaign",
  "unresearched",
  "below_icp_score",
  "not_qualified",
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  no_email: "No email address",
  invalid_email: "Invalid email address",
  risky_email: "Role or disposable address",
  do_not_contact: "On the Do Not Contact list",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced or marked as spam",
  cooldown: "Contacted recently (cooldown)",
  in_other_campaign: "Already in another active campaign",
  unresearched: "Not researched yet",
  below_icp_score: "Below the minimum ICP score",
  not_qualified: "Not qualified against your ICP",
};

// ---- audience ---------------------------------------------------------------------------------------------------

export const audienceDefinitionSchema = z.object({
  source: z.enum(["all", "segment", "leads"]).default("all"),
  segmentId: z.number().int().positive().nullable().default(null),
  leadIds: z.array(z.number().int().positive()).max(5000).default([]),
  filters: z
    .object({
      minIcpScore: z.number().int().min(0).max(100).nullable().default(null),
      requireResearched: z.boolean().default(false),
      qualifiedOnly: z.boolean().default(false),
      /** Role accounts (info@, sales@) and disposable domains are excluded unless the user opts in. */
      includeRiskyEmails: z.boolean().default(false),
    })
    .default({ minIcpScore: null, requireResearched: false, qualifiedOnly: false, includeRiskyEmails: false }),
});
export type AudienceDefinition = z.infer<typeof audienceDefinitionSchema>;

export const DEFAULT_AUDIENCE: AudienceDefinition = audienceDefinitionSchema.parse({});

// ---- send window ------------------------------------------------------------------------------------------------

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const sendWindowSchema = z
  .object({
    /** 0 = Sunday … 6 = Saturday, in the window's timezone. */
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  })
  .refine((w) => w.startHour < w.endHour, { message: "The window must end after it starts", path: ["endHour"] });
export type SendWindow = z.infer<typeof sendWindowSchema>;

export const DEFAULT_SEND_WINDOW: SendWindow = { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: "UTC" };

// ---- steps + basics ---------------------------------------------------------------------------------------------

export const MAX_STEPS = 10;

export const stepInputSchema = z.object({
  waitDays: z.number().int().min(0).max(90),
  subject: z.string().max(200).default(""),
  body: z.string().max(8000).default(""),
  mode: z.enum(STEP_MODES).default("template"),
});
export type StepInput = z.infer<typeof stepInputSchema>;

/** Day 0 / 3 / 7 / 12 — waits are gaps from the previous step (the legacy scheduler's semantics). */
export const DEFAULT_WAIT_DAYS = [0, 3, 4, 5] as const;

export const basicsSchema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name").max(120),
  mailboxId: z.number().int().positive().nullable(),
  tone: z.enum(TONES),
  dailyLimit: z.number().int().min(1).max(1000),
  totalLimit: z.number().int().min(1).max(5000).nullable(),
  sendWindow: sendWindowSchema,
  allowTemplateFallback: z.boolean(),
});
export type CampaignBasics = z.infer<typeof basicsSchema>;

export type CampaignStep = {
  id: number;
  order: number;
  waitDays: number;
  subject: string;
  body: string;
  mode: StepMode;
};

export type CampaignRecord = {
  id: number;
  workspaceId: number;
  name: string;
  status: CampaignStatus;
  sendModel: SendModel;
  mailboxId: number | null;
  fromEmail: string | null;
  tone: (typeof TONES)[number];
  dailyLimit: number;
  totalLimit: number | null;
  sendWindow: SendWindow;
  audience: AudienceDefinition;
  allowTemplateFallback: boolean;
  approvalId: number | null;
  approvedAt: string | null;
  startedAt: string | null;
  totalLeads: number;
  blockedCount: number;
  sentCount: number;
  repliedCount: number;
  createdAt: string;
  steps: CampaignStep[];
};

/** Follow-ups (steps after the first) carry no subject of their own: they are threaded replies ("Re: …"). */
export const isFollowUp = (order: number) => order > 1;
