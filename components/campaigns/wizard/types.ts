import type { Channel } from "@/lib/ai/messages";

export type SequenceStep = {
  channel: Channel;
  waitDays: number;
  subject?: string;
  body: string;
};

/** Multi-channel default (only offered when FEATURE_LINKEDIN_AUTOMATION is on — D-05). */
export const DEFAULT_STEPS: SequenceStep[] = [
  { channel: "email", waitDays: 0, subject: "", body: "" },
  { channel: "linkedin_dm", waitDays: 2, body: "" },
  { channel: "email", waitDays: 4, subject: "", body: "" },
];

/** Email-only default: day 0 · 3 · 7 · 12. Follow-ups are sent as replies in the same thread, so they have no subject. */
export const DEFAULT_EMAIL_STEPS: SequenceStep[] = [
  { channel: "email", waitDays: 0, subject: "", body: "" },
  { channel: "email", waitDays: 3, body: "" },
  { channel: "email", waitDays: 4, body: "" },
  { channel: "email", waitDays: 5, body: "" },
];
