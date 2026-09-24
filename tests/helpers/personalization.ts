import type { GenerationOutput, PersonalizationContext } from "@/lib/domain/personalization/types";

/** A small, realistic context: two verified evidence items, a named sender with positioning. */
export function makeContext(overrides: Partial<PersonalizationContext> = {}): PersonalizationContext {
  return {
    lead: { id: 1, firstName: "Sarah", fullName: "Sarah Chen", title: "VP Sales" },
    company: { name: "Acme", domain: "acme.example", industry: "B2B SaaS", description: "Acme provides outbound analytics software for B2B revenue teams." },
    sender: { name: "Alex Rivera", company: "LeadCo", positioning: "We help outbound teams book more qualified meetings without hiring more SDRs." },
    evidence: [
      {
        id: 11, claim: "Acme is hiring 4 sales roles", snippet: "We're hiring: 4 open roles on our sales team including Account Executive.",
        sourceUrl: "https://acme.example/careers", sourceTitle: "Careers at Acme", sourceType: "careers", capturedAt: "2026-09-20T00:00:00.000Z", signalType: "HIRING",
      },
      {
        id: 12, claim: "Acme provides outbound analytics software for B2B teams", snippet: "Acme provides outbound analytics software for B2B revenue teams.",
        sourceUrl: "https://acme.example/", sourceTitle: "Acme", sourceType: "website", capturedAt: "2026-09-20T00:00:00.000Z", signalType: null,
      },
    ],
    strategy: { whyContact: "Acme provides outbound analytics software for B2B teams.", whyNow: "Acme is hiring 4 sales roles.", whyPerson: "", potentialProblem: "Scaling outbound with new hires", recommendedAngle: "Ramping new sales hires", insufficient: false },
    tone: "concise",
    includeNews: false,
    notes: [],
    ...overrides,
  };
}

export const GOOD_BODY = `Hi Sarah,

I saw that Acme is hiring 4 sales roles.

We help outbound teams book more qualified meetings without hiring more SDRs.

Worth a quick chat about how you plan to ramp them?

Alex`;

export function goodOutput(overrides: Partial<GenerationOutput> = {}): GenerationOutput {
  return {
    subject: "Ramping your new sales hires",
    body: GOOD_BODY,
    angle: "New sales hires",
    used_evidence_ids: [11],
    personalized_claims: [{ text: "Acme is hiring 4 sales roles", evidence_id: 11 }],
    confidence: 0.8,
    ...overrides,
  };
}
