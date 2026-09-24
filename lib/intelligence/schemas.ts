import { z } from "zod";

/**
 * zod mirrors of the Intelligence Engine contract (services/intelligence/openapi.json is the source of truth).
 * The engine is a trusted PEER, not a trusted SOURCE: every response is parsed here before anything is persisted.
 * Unknown keys are stripped (additive changes within /v1 must not break us); a missing/renamed one fails loudly.
 * tests/unit/intelligence-contract.test.ts compares these shapes with openapi.json and the engine's golden fixtures.
 */

export const SIGNAL_TYPES = ["FUNDING", "HIRING", "EXPANSION", "PRODUCT_LAUNCH", "LEADERSHIP_CHANGE", "TECH_CHANGE", "JOB_POSTING", "NEWS"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];
export const SOURCE_TYPES = ["website", "careers", "news", "search", "jobs_board", "press_release", "public_data"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "expected an ISO date");

/** Evidence links are rendered as <a href>: only http(s) may ever be stored (blocks javascript:/data: URLs). */
const httpUrl = z.string().max(2048).refine((u) => /^https?:\/\//i.test(u), "source_url must be http(s)");

export const verificationSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  method: z.array(z.string()).default([]),
  checked_at: z.string(),
  notes: z.array(z.string()).default([]),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1).max(2000),
  source_url: httpUrl,
  source_title: z.string().max(500).nullable().optional(),
  source_type: z.enum(SOURCE_TYPES),
  snippet: z.string().min(1).max(4000),
  content_hash: z.string().min(1).max(200),
  captured_at: z.string(),
  verification: verificationSchema,
});

const evidenceIds = z.array(z.string()).default([]);

export const companyProfileSchema = z.object({
  name: z.string(),
  domain: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  employee_band: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  products: z.array(z.string()).default([]),
  market: z.string().nullable().optional(),
  business_model: z.string().nullable().optional(),
  fields: z.array(z.object({ field: z.string(), value: z.string(), evidence_ids: evidenceIds })).default([]),
});

export const personSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  relevance: z.string().default(""),
  evidence_ids: evidenceIds,
});

export const signalSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SIGNAL_TYPES),
  title: z.string().min(1).max(500),
  description: z.string().default(""),
  detected_at: isoDate.nullable().optional(),
  confidence: z.number().min(0).max(1),
  verified: z.boolean(),
  evidence_ids: evidenceIds,
  conflicts_with: z.array(z.string()).default([]),
});

const criterionStatus = z.enum(["met", "partial", "not_met", "unknown"]);

export const icpBreakdownItemSchema = z.object({
  criterion: z.string(),
  status: criterionStatus,
  weight: z.number(),
  points: z.number(),
  value_found: z.string().nullable().optional(),
  evidence_ids: evidenceIds,
});

export const icpResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  breakdown: z.array(icpBreakdownItemSchema).default([]),
});

export const intentResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: z
    .array(
      z.object({
        signal_id: z.string().nullable().optional(),
        signal_type: z.enum(SIGNAL_TYPES).nullable().optional(),
        weight: z.number(),
        confidence: z.number(),
        recency_factor: z.number(),
        points: z.number(),
      }),
    )
    .default([]),
});

export const whyFitItemSchema = z.object({
  criterion: z.string(),
  status: criterionStatus,
  text: z.string(),
  evidence_ids: evidenceIds,
});

export const scoringInputsSchema = z
  .object({
    industry: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    employee_count: z.number().int().nullable().optional(),
    keywords_found: z.array(z.string()).default([]),
    person_title: z.string().nullable().optional(),
  })
  .default({ keywords_found: [] });

export const outreachSchema = z
  .object({
    insufficient_evidence: z.boolean().default(false),
    why_contact: z.string().default(""),
    why_now: z.string().default(""),
    why_person: z.string().default(""),
    potential_problem: z.string().default(""),
    recommended_angle: z.string().default(""),
    evidence_ids: evidenceIds,
    avoid: z.array(z.string()).default([]),
  })
  .default({ insufficient_evidence: true, why_contact: "", why_now: "", why_person: "", potential_problem: "", recommended_angle: "", evidence_ids: [], avoid: [] });

export const researchResultSchema = z.object({
  schema_version: z.literal("1"),
  scoring_version: z.string().default("1"),
  company: companyProfileSchema,
  people: z.array(personSchema).default([]),
  signals: z.array(signalSchema).default([]),
  evidence: z.array(evidenceSchema).max(300),
  icp: icpResultSchema,
  intent: intentResultSchema,
  scoring_inputs: scoringInputsSchema,
  qualified: z.boolean().default(false),
  why_fit: z.array(whyFitItemSchema).default([]),
  outreach: outreachSchema,
  unknowns: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type EngineResearchResult = z.infer<typeof researchResultSchema>;
export type EngineEvidence = z.infer<typeof evidenceSchema>;
export type EngineSignal = z.infer<typeof signalSchema>;

// ---- run envelope -----------------------------------------------------------------------------------

export const traceStepSchema = z.object({
  seq: z.number().int(),
  stage: z.string(),
  agent: z.string().nullable().optional(),
  tool: z.string().nullable().optional(),
  started_at: z.string(),
  duration_ms: z.number().int(),
  status: z.string(),
  input_summary: z.string().default(""),
  output_summary: z.string().default(""),
  tokens_in: z.number().int().default(0),
  tokens_out: z.number().int().default(0),
  error: z.string().nullable().optional(),
});

export const usageItemSchema = z.object({
  kind: z.enum(["llm", "search", "fetch", "provider"]),
  provider: z.string(),
  model: z.string().nullable().optional(),
  units: z.number().default(1),
  tokens_in: z.number().int().default(0),
  tokens_out: z.number().int().default(0),
  cost_estimate: z.number().default(0),
});

export const engineErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  retryable: z.boolean().default(false),
});

export const runStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "canceled"]);

export const runViewSchema = z.object({
  run_id: z.string(),
  status: runStatusSchema,
  progress: z.object({ stage: z.string(), pct: z.number() }).default({ stage: "queued", pct: 0 }),
  result: z.unknown().nullable().optional(),
  error: engineErrorSchema.nullable().optional(),
  trace: z.array(traceStepSchema).default([]),
  usage: z.array(usageItemSchema).default([]),
});
export type EngineRunView = Omit<z.infer<typeof runViewSchema>, "result"> & { result?: unknown };

export const runCreatedSchema = z.object({ run_id: z.string(), status: runStatusSchema });

export const scoreDataSchema = z.object({
  scoring_version: z.string(),
  icp: icpResultSchema,
  intent: intentResultSchema,
  qualified: z.boolean(),
  why_fit: z.array(whyFitItemSchema).default([]),
});
export type EngineScoreData = z.infer<typeof scoreDataSchema>;

export const capabilitiesSchema = z.object({
  contract_version: z.string(),
  fake_mode: z.boolean().default(false),
  tasks: z.array(z.string()),
  connectors: z.array(z.object({ name: z.string(), available: z.boolean(), reason: z.string().nullable().optional() })).default([]),
  task_costs: z
    .array(z.object({ task: z.string(), typical_llm_calls: z.number(), typical_pages: z.number(), typical_cost_usd: z.number() }))
    .default([]),
  llm_model: z.string().nullable().optional(),
});
export type EngineCapabilities = z.infer<typeof capabilitiesSchema>;

// ---- requests -----------------------------------------------------------------------------------------

export type EngineIcp = {
  industries: { value: string; weight: number }[];
  employee_range: { min: number | null; max: number | null; weight: number } | null;
  geographies: { value: string; weight: number }[];
  titles: { keywords: string[]; weight: number }[];
  keyword_signals: { keyword: string; weight: number }[];
  exclusions: { industries: string[]; domains: string[]; titles: string[] };
  min_score_to_qualify: number;
};

export type EngineRunRequest = {
  idempotency_key: string;
  task: "company_research" | "lead_research" | "find_signals";
  input: {
    company: { name: string; domain?: string | null; linkedin_url?: string | null; location?: string | null };
    lead?: { name: string; title?: string | null; linkedin_url?: string | null } | null;
    freshness_days?: number;
  };
  context: { icp: EngineIcp; positioning: string; offer_keywords: string[]; locale?: string };
  budgets?: { max_seconds?: number; max_pages?: number; max_search_queries?: number; max_llm_calls?: number; max_cost_usd?: number };
};

export type EngineScoreRequest = {
  icp: EngineIcp;
  company: { industry?: string | null; country?: string | null; employee_count?: number | null; domain?: string | null; keywords_found?: string[] };
  person?: { title?: string | null } | null;
  signals: { id?: string; type: SignalType; confidence: number; detected_at?: string | null; verified: boolean }[];
  evidence?: Record<string, string[]>;
  as_of?: string;
};
