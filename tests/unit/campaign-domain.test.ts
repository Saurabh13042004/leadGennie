import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, TRANSITIONS, isStructureEditable, isContentEditable } from "@/lib/domain/campaigns/state-machine";
import { planSchedule, zonedTimeToUtc } from "@/lib/domain/campaigns/schedule";
import { classifyAudience, exclusionFor, type AudienceCandidate, type AudienceFacts } from "@/lib/domain/campaigns/audience";
import { evaluateReadiness } from "@/lib/domain/campaigns/readiness";
import { fillPlaceholders, renderStep, threadedSubject, unknownPlaceholders, withUnsubscribeFooter } from "@/lib/campaigns/render";
import { CAMPAIGN_STATUSES, DEFAULT_AUDIENCE, DEFAULT_SEND_WINDOW, EXCLUSION_REASONS, audienceDefinitionSchema, sendWindowSchema, type CampaignRecord } from "@/lib/domain/campaigns/types";
import type { LeadDraft } from "@/lib/domain/campaigns/repository";

describe("campaign state machine", () => {
  it("never reaches running without going through approval", () => {
    expect(canTransition("draft", "running")).toBe(false);
    expect(canTransition("pending_approval", "running")).toBe(false);
    expect(canTransition("rejected", "running")).toBe(false);
    expect(canTransition("ready", "running")).toBe(true);
  });
  it("terminal states never move, and every listed target is a real status", () => {
    for (const s of ["completed", "failed", "canceled"] as const) expect(TRANSITIONS[s]).toEqual([]);
    for (const [from, tos] of Object.entries(TRANSITIONS)) {
      expect(CAMPAIGN_STATUSES).toContain(from);
      for (const to of tos) expect(CAMPAIGN_STATUSES).toContain(to);
    }
  });
  it("illegal transitions throw a CONFLICT", () => {
    expect(() => assertTransition("completed", "running")).toThrow(/can't become/);
    expect(() => assertTransition("draft", "paused")).toThrow();
    expect(() => assertTransition("pending_approval", "draft")).toThrow();
    expect(() => assertTransition("running", "paused")).not.toThrow();
  });
  it("structure is editable only before approval; copy stays editable while running", () => {
    expect(isStructureEditable("draft")).toBe(true);
    expect(isStructureEditable("rejected")).toBe(true);
    expect(isStructureEditable("ready")).toBe(false);
    expect(isContentEditable("running")).toBe(true);
    expect(isContentEditable("pending_approval")).toBe(false);
    expect(isContentEditable("completed")).toBe(false);
  });
});

describe("send-window schedule", () => {
  const window = { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: "UTC" };
  // Wednesday 2026-09-23 10:00 UTC (inside the window)
  const wed10 = new Date("2026-09-23T10:00:00Z");

  it("sends the first batch now when launched inside the window, then fills later days at the window start", () => {
    const p = planSchedule({ leadCount: 3, waitDays: [0], window, dailyLimit: 2, now: wed10 });
    expect(p.firstSendAt.map((d) => d.toISOString())).toEqual(["2026-09-23T10:00:00.000Z", "2026-09-23T10:00:00.000Z", "2026-09-24T09:00:00.000Z"]);
  });

  it("never puts more than dailyLimit sends (all steps counted) on one day", () => {
    const p = planSchedule({ leadCount: 25, waitDays: [0, 3, 4, 5], window, dailyLimit: 7, now: wed10 });
    const perDay = new Map<string, number>();
    for (const s of p.sends) perDay.set(s.at.toISOString().slice(0, 10), (perDay.get(s.at.toISOString().slice(0, 10)) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(7);
    expect(p.sends).toHaveLength(100);
  });

  it("skips days outside the window and keeps each follow-up at least its wait after the previous step", () => {
    const p = planSchedule({ leadCount: 5, waitDays: [0, 3, 4], window, dailyLimit: 3, now: wed10 });
    for (const s of p.sends) expect([1, 2, 3, 4, 5]).toContain(s.at.getUTCDay());
    for (let i = 0; i < 5; i++) {
      const mine = p.sends.filter((s) => s.leadIndex === i).sort((a, b) => a.stepIndex - b.stepIndex);
      expect((mine[1].at.getTime() - mine[0].at.getTime()) / 86_400_000).toBeGreaterThanOrEqual(3 - 1 / 24);
      expect((mine[2].at.getTime() - mine[1].at.getTime()) / 86_400_000).toBeGreaterThanOrEqual(4 - 1 / 24);
    }
  });

  it("launching after the window closes starts the next allowed day; a Friday-evening launch starts Monday", () => {
    const fri18 = new Date("2026-09-25T18:00:00Z");
    const p = planSchedule({ leadCount: 1, waitDays: [0], window, dailyLimit: 10, now: fri18 });
    expect(p.firstSendAt[0].toISOString()).toBe("2026-09-28T09:00:00.000Z");
  });

  it("respects the campaign's timezone (and DST)", () => {
    expect(zonedTimeToUtc({ y: 2026, m: 1, d: 15 }, 9, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedTimeToUtc({ y: 2026, m: 7, d: 15 }, 9, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedTimeToUtc({ y: 2026, m: 7, d: 15 }, 9, "Asia/Kolkata").toISOString()).toBe("2026-07-15T03:30:00.000Z");
    const p = planSchedule({ leadCount: 1, waitDays: [0], window: { ...window, timezone: "Asia/Kolkata" }, dailyLimit: 5, now: new Date("2026-09-23T13:00:00Z") });
    // 18:30 IST: the window is closed, so Thursday 09:00 IST = 03:30 UTC.
    expect(p.firstSendAt[0].toISOString()).toBe("2026-09-24T03:30:00.000Z");
  });

  it("validates windows", () => {
    expect(sendWindowSchema.safeParse({ ...window, startHour: 17, endHour: 9 }).success).toBe(false);
    expect(sendWindowSchema.safeParse({ ...window, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(sendWindowSchema.safeParse({ ...window, days: [] }).success).toBe(false);
  });
});

describe("audience classification", () => {
  const lead = (id: number, over: Partial<AudienceCandidate> = {}): AudienceCandidate => ({
    id, fullName: `Lead ${id}`, email: `lead${id}@acme.example`, company: "Acme", emailStatus: "unverified", researchStatus: "done", icpScore: 80, qualified: true, ...over,
  });
  const facts = (over: Partial<AudienceFacts> = {}): AudienceFacts => ({ suppressed: new Map(), cooldown: new Set(), inOtherCampaign: new Set(), ...over });
  const filters = DEFAULT_AUDIENCE.filters;

  it.each([
    ["no_email", lead(1, { email: null }), facts(), filters],
    ["invalid_email", lead(2, { email: "not-an-email" }), facts(), filters],
    ["invalid_email", lead(3, { emailStatus: "invalid" }), facts(), filters],
    ["risky_email", lead(4, { email: "info@acme.example" }), facts(), filters],
    ["do_not_contact", lead(5), facts({ suppressed: new Map([["lead5@acme.example", "do_not_contact"]]) }), filters],
    ["unsubscribed", lead(6), facts({ suppressed: new Map([["lead6@acme.example", "unsubscribed"]]) }), filters],
    ["bounced", lead(7), facts({ suppressed: new Map([["lead7@acme.example", "bounced"]]) }), filters],
    ["cooldown", lead(8), facts({ cooldown: new Set([8]) }), filters],
    ["in_other_campaign", lead(9), facts({ inOtherCampaign: new Set([9]) }), filters],
    ["unresearched", lead(10, { researchStatus: "none" }), facts(), { ...filters, requireResearched: true }],
    ["below_icp_score", lead(11, { icpScore: 40 }), facts(), { ...filters, minIcpScore: 60 }],
    ["not_qualified", lead(12, { qualified: false }), facts(), { ...filters, qualifiedOnly: true }],
  ] as const)("excludes for %s", (reason, c, f, fl) => {
    expect(exclusionFor(c, f, fl)).toBe(reason);
  });

  it("includes role addresses only when the user opts in, and lets a clean lead through", () => {
    expect(exclusionFor(lead(1, { email: "sales@acme.example" }), facts(), { ...filters, includeRiskyEmails: true })).toBeNull();
    expect(exclusionFor(lead(2), facts(), filters)).toBeNull();
  });

  it("counts every reason, keeps samples, and never emails the same address twice", () => {
    const r = classifyAudience(
      [lead(1), lead(2, { email: null }), lead(3, { email: "LEAD1@acme.example" }), lead(4), lead(5, { email: "x" })],
      facts({ cooldown: new Set([4]) }),
      DEFAULT_AUDIENCE,
    );
    expect(r.eligible.map((l) => l.id)).toEqual([1]);
    expect(r.exclusions).toMatchObject({ no_email: 1, in_other_campaign: 1, cooldown: 1, invalid_email: 1 });
    expect(Object.keys(r.exclusions).sort()).toEqual([...EXCLUSION_REASONS].sort());
    expect(r.samples.cooldown).toEqual([{ id: 4, name: "Lead 4" }]);
    expect(r.excludedIds.no_email).toEqual([2]);
    expect(r.eligible.length + Object.values(r.exclusions).reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("parses definitions with safe defaults", () => {
    expect(audienceDefinitionSchema.parse({})).toEqual(DEFAULT_AUDIENCE);
    expect(audienceDefinitionSchema.safeParse({ source: "segment", segmentId: -1 }).success).toBe(false);
  });
});

describe("render (shared by preview, launch and the sender)", () => {
  const first = { order: 1, subject: "Quick question, {{first_name}}", body: "Hi {{first_name}}, how does {{company}} book meetings?", mode: "template" as const };
  const follow = { order: 2, subject: "", body: "Following up, {{first_name}}.", mode: "template" as const };
  const lead = { fullName: "Dr. Sarah Chen", company: "Acme" };

  it("fills the supported placeholders and leaves unknown ones visible", () => {
    expect(fillPlaceholders("Hi {{ first_name }} at {{company}} {{title}}", lead)).toBe("Hi Sarah at Acme {{title}}");
    expect(fillPlaceholders("{{company}}", { fullName: "X", company: null })).toBe("your company");
    expect(unknownPlaceholders("{{first_name}} {{title}} {{ city }}")).toEqual(["{{title}}", "{{ city }}"]);
  });

  it("threads follow-ups under the first subject", () => {
    expect(renderStep(follow, first, lead, null, { allowTemplateFallback: false })!.subject).toBe("Re: Quick question, Sarah");
    expect(threadedSubject("Re: hi")).toBe("Re: hi");
  });

  it("uses the lead's approved draft for a personalized first step, including in the thread subject", () => {
    const p1 = { ...first, mode: "personalized" as const };
    const draft = { id: 9, subject: "Your 8 SDR roles", body: "Hi Sarah — sourced body" };
    expect(renderStep(p1, p1, lead, draft, { allowTemplateFallback: false })).toMatchObject({ subject: "Your 8 SDR roles", body: draft.body, source: "draft", draftId: 9 });
    expect(renderStep(follow, p1, lead, draft, { allowTemplateFallback: false })!.subject).toBe("Re: Your 8 SDR roles");
  });

  it("without an approved draft: null (a blocker) unless the template fallback is explicitly allowed", () => {
    const p1 = { ...first, mode: "personalized" as const };
    expect(renderStep(p1, p1, lead, null, { allowTemplateFallback: false })).toBeNull();
    expect(renderStep(p1, p1, lead, null, { allowTemplateFallback: true })).toMatchObject({ source: "template", subject: "Quick question, Sarah" });
  });

  it("appends the unsubscribe footer the same way everywhere", () => {
    expect(withUnsubscribeFooter("Body", "https://x/u")).toBe("Body\n\n---\nUnsubscribe: https://x/u");
  });
});

describe("readiness (blockers vs warnings)", () => {
  const base = (over: Partial<CampaignRecord> = {}): CampaignRecord => ({
    id: 1, workspaceId: 1, name: "Q4", status: "draft", sendModel: "leads", mailboxId: 1, fromEmail: "a@x.example", tone: "concise",
    dailyLimit: 50, totalLimit: null, sendWindow: DEFAULT_SEND_WINDOW, audience: DEFAULT_AUDIENCE, allowTemplateFallback: false,
    approvalId: null, approvedAt: null, startedAt: null, pausedReason: null, totalLeads: 0, blockedCount: 0, sentCount: 0, repliedCount: 0, createdAt: "2026-09-25T00:00:00Z",
    steps: [
      { id: 1, order: 1, waitDays: 0, subject: "Hi {{first_name}}", body: "Hello {{first_name}}", mode: "template" },
      { id: 2, order: 2, waitDays: 3, subject: "", body: "Following up", mode: "template" },
    ],
    ...over,
  });
  const candidate = (id: number): AudienceCandidate => ({ id, fullName: `L${id}`, email: `l${id}@a.example`, company: "A", emailStatus: null, researchStatus: "done", icpScore: 90, qualified: true });
  const audience = (n: number) => ({ ...classifyAudience(Array.from({ length: n }, (_, i) => candidate(i + 1)), { suppressed: new Map(), cooldown: new Set(), inOtherCampaign: new Set() }, DEFAULT_AUDIENCE), capped: false, notes: [] });
  const mailbox = { id: 1, email: "a@x.example", active: true, verified: true, dailyLimit: 100 };
  const run = (c: CampaignRecord, over: { n?: number; mb?: typeof mailbox | null; drafts?: Map<number, LeadDraft> } = {}) =>
    evaluateReadiness(c, { audience: audience(over.n ?? 3), mailbox: over.mb === undefined ? mailbox : over.mb, drafts: over.drafts ?? new Map() });

  it("a complete template campaign has no blockers", () => {
    expect(run(base()).blockers).toEqual([]);
  });

  it("launch is blocked without a sender name AND postal address, and clears once both are set", () => {
    const withIdentity = (identity: { name: string | null; address: string | null }) =>
      evaluateReadiness(base(), { audience: audience(3), mailbox, drafts: new Map(), identity });
    for (const identity of [{ name: null, address: null }, { name: "Acme", address: null }, { name: null, address: "1 Main St" }, { name: " ", address: " " }]) {
      const r = withIdentity(identity);
      expect(r.blockers.map((b) => b.message)).toEqual([expect.stringMatching(/sender name and postal address/)]);
      expect(r.blockers[0].section).toBe("review");
    }
    expect(withIdentity({ name: "Acme Inc", address: "1 Main St, Springfield" }).blockers).toEqual([]);
  });

  it.each([
    ["no mailbox", base({ mailboxId: null }), { mb: null }, /Pick a sending mailbox/],
    ["unverified mailbox", base(), { mb: { ...mailbox, verified: false } }, /isn't active on a verified domain/],
    ["daily limit above the mailbox's", base({ dailyLimit: 150 }), {}, /higher than/],
    ["empty audience", base(), { n: 0 }, /Nobody in this audience/],
    ["missing first subject", base({ steps: [{ id: 1, order: 1, waitDays: 0, subject: "", body: "x", mode: "template" }] }), {}, /needs a subject/],
    ["empty step body", base({ steps: [{ id: 1, order: 1, waitDays: 0, subject: "s", body: " ", mode: "template" }] }), {}, /has no message/],
    ["unknown placeholder", base({ steps: [{ id: 1, order: 1, waitDays: 0, subject: "s", body: "{{title}}", mode: "template" }] }), {}, /can't be filled in/],
  ] as const)("blocks: %s", (_n, c, opts, rx) => {
    expect(run(c, opts as never).blockers.map((b) => b.message).join(" | ")).toMatch(rx);
  });

  it("personalized first step: unapproved drafts block launch unless the fallback is opted into", () => {
    const c = base({ steps: [{ id: 1, order: 1, waitDays: 0, subject: "", body: "", mode: "personalized" }] });
    const drafts = new Map<number, LeadDraft>([
      [1, { leadId: 1, draftId: 11, status: "approved", subject: "s", body: "b" }],
      [2, { leadId: 2, draftId: 12, status: "failed_validation", subject: "s", body: "b" }],
    ]);
    const r = run(c, { drafts });
    expect(r.drafts).toMatchObject({ approved: 1, failed: 1, missing: 1 });
    expect(r.blockers.some((b) => b.section === "personalization")).toBe(true);
    expect(r.drafts.blockingLeads.map((l) => l.reason).sort()).toEqual(["failed_validation", "missing"]);

    const withFallback = run({ ...c, allowTemplateFallback: true }, { drafts });
    expect(withFallback.blockers.map((b) => b.message).join()).toMatch(/needs a subject|template to fall back/);
    const fixed = run({ ...c, allowTemplateFallback: true, steps: [{ id: 1, order: 1, waitDays: 0, subject: "Hi", body: "Hello", mode: "personalized" }] }, { drafts });
    expect(fixed.blockers).toEqual([]);
    expect(fixed.drafts.usingFallback).toBe(2);
    expect(fixed.warnings.some((w) => /template instead/.test(w.message))).toBe(true);
  });

  it("total limit caps enrollment and says how many are left out", () => {
    const r = run(base({ totalLimit: 2 }), { n: 5 });
    expect(r.willEnroll).toBe(2);
    expect(r.overTotalLimit).toBe(3);
  });

  it("warns (doesn't block) on spammy template copy", () => {
    const r = run(base({ steps: [{ id: 1, order: 1, waitDays: 0, subject: "Hi", body: "Act now — limited time offer, click here", mode: "template" }] }));
    expect(r.blockers).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
