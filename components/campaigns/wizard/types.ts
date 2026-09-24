import type { Channel } from "@/lib/ai/messages";

export type SequenceStep = {
  channel: Channel;
  waitDays: number;
  subject?: string;
  body: string;
};

export const DEFAULT_STEPS: SequenceStep[] = [
  { channel: "email", waitDays: 0, subject: "", body: "" },
  { channel: "linkedin_dm", waitDays: 2, body: "" },
  { channel: "email", waitDays: 4, subject: "", body: "" },
];
