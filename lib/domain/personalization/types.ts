import { z } from "zod";
import { Type, type LlmSchema } from "@/lib/ai/llm-types";

/** Tone options are real: each maps to concrete prompt guidance in tone.ts. */
export const TONES = ["concise", "friendly", "formal", "direct"] as const;
export type Tone = (typeof TONES)[number];
export const isTone = (v: unknown): v is Tone => typeof v === "string" && (TONES as readonly string[]).includes(v);

export const DRAFT_STATUSES = ["draft", "edited", "approved", "rejected", "failed_validation"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export type IssueSeverity = "error" | "warning";
export type ValidationIssue = { code: string; severity: IssueSeverity; message: string };

/**
 * What the model must return. `personalized_claims` is the contract that makes personalization checkable:
 * every phrase that leans on evidence is listed with the evidence row it came from, so the validators can hold
 * the model to it and the UI can link the phrase to its source.
 */
export const generationOutputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  angle: z.string().trim().max(400),
  used_evidence_ids: z.array(z.number().int()).max(30),
  personalized_claims: z.array(z.object({ text: z.string().trim().min(1).max(400), evidence_id: z.number().int() })).max(12),
  confidence: z.number().min(0).max(1),
});
export type GenerationOutput = z.infer<typeof generationOutputSchema>;

export const generationJsonSchema: LlmSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    angle: { type: Type.STRING },
    used_evidence_ids: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    personalized_claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING }, evidence_id: { type: Type.INTEGER } },
        required: ["text", "evidence_id"],
      },
    },
    confidence: { type: Type.NUMBER },
  },
  required: ["subject", "body", "angle", "used_evidence_ids", "personalized_claims", "confidence"],
};

/** One piece of VERIFIED evidence the model may lean on. Nothing else about the recipient may be asserted. */
export type ContextEvidence = {
  id: number;
  claim: string;
  snippet: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceType: string;
  capturedAt: string;
  /** Signal type when the evidence backs a signal (FUNDING, HIRING, …); null for plain profile facts. */
  signalType: string | null;
};

export type PersonalizationContext = {
  lead: { id: number; firstName: string | null; fullName: string; title: string | null };
  company: { name: string; domain: string | null; industry: string | null; description: string | null };
  sender: { name: string | null; company: string | null; positioning: string };
  /** Verified, recency-filtered, capped. The ONLY evidence that reaches the model. */
  evidence: ContextEvidence[];
  strategy: { whyContact: string; whyNow: string; whyPerson: string; potentialProblem: string; recommendedAngle: string; insufficient: boolean } | null;
  tone: Tone;
  includeNews: boolean;
  /** Why some evidence was withheld (shown to the user: "News excluded — toggle is off"). */
  notes: string[];
};

export type DraftClaim = { text: string; evidenceId: number };
