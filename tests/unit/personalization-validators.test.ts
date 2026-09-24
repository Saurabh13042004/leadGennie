import { describe, expect, it } from "vitest";
import { hasErrors, validateEdit, validateGeneration, claimSupported, sentencesOf } from "@/lib/domain/personalization/validators";
import { segmentBody } from "@/lib/domain/personalization/segments";
import type { GenerationOutput } from "@/lib/domain/personalization/types";
import { GOOD_BODY, goodOutput, makeContext } from "../helpers/personalization";

const ctx = makeContext();
const codes = (out: GenerationOutput, c = ctx) => validateGeneration(out, c).filter((i) => i.severity === "error").map((i) => i.code);
const body = (text: string, extra: Partial<GenerationOutput> = {}) => goodOutput({ body: `Hi Sarah,\n\n${text}\n\nAlex`, personalized_claims: [], used_evidence_ids: [], ...extra });

describe("validators: a clean, sourced draft passes", () => {
  it("accepts the reference draft with no errors", () => {
    const issues = validateGeneration(goodOutput(), ctx);
    expect(hasErrors(issues)).toBe(false);
  });

  it("accepts an honest generic note when there is no evidence", () => {
    const empty = makeContext({ evidence: [], strategy: null });
    const out = body("I work with outbound teams at companies like yours, and wanted to ask how you currently handle booking meetings. Is that something on your radar this quarter?");
    expect(codes(out, empty)).toEqual([]);
  });

  it("does not treat a title (“Head of Growth”) or a 15-minute call as a factual claim", () => {
    const c = makeContext({ lead: { id: 1, firstName: "Sarah", fullName: "Sarah Chen", title: "Head of Growth" } });
    const out = body("As Head of Growth you own pipeline for the team. Could we take 15 minutes next week to compare notes on outbound?");
    expect(codes(out, c)).toEqual([]);
  });

  it("lets the sender describe their own offer (positioning) without a claim entry", () => {
    expect(codes(body("We help outbound teams book more qualified meetings without hiring more SDRs. Is that relevant for you?"))).toEqual([]);
  });
});

/** Found by the live eval: these ordinary drafts were rejected. They must stay accepted. */
describe("validators: known false positives stay fixed", () => {
  const noEv = makeContext({ evidence: [], strategy: null });
  it("a Title-Case subject is not a pile of invented entities", () => {
    const out = body("I work with outbound teams and wanted to ask how you currently book meetings. Is that on your radar this quarter?", { subject: "Exploring Meeting Efficiency Strategies" });
    expect(codes(out, noEv)).toEqual([]);
  });
  it("…but a Title-Case subject still can't smuggle in an unsupported event", () => {
    const out = body("I work with outbound teams and wanted to ask how you currently book meetings. Is that on your radar this quarter?", { subject: "Exploring Berlin Expansion Opportunities" });
    expect(hasErrors(validateGeneration(out, noEv))).toBe(true);
  });
  it("“B2B” in a subject is not a number claim", () => {
    const out = body("I work with outbound teams and wanted to ask how you currently book meetings. Is that on your radar this quarter?", { subject: "B2B outbound question" });
    expect(codes(out, noEv)).toEqual([]);
  });
  it("an ordinary question with generic business words is not an unsupported claim", () => {
    const out = body("Would you be open to exploring how a different approach could streamline your growth initiatives? We help outbound teams book more qualified meetings without hiring more SDRs.", {});
    expect(codes(out, noEv)).toEqual([]);
  });
  it("a claim phrase that starts a sentence isn't rejected for its capitalized first word", () => {
    const c = makeContext({ evidence: [{ ...ctx.evidence[0], id: 21, claim: "Dana Ortiz joined Acme as VP of Marketing", snippet: "Acme announced that Dana Ortiz joined as Vice President of Marketing (VP of Marketing)." }] });
    const out = goodOutput({
      body: "Hi Sarah,\n\nWith Dana Ortiz joined as VP of Marketing at Acme, your team may be reshaping outbound. We help outbound teams book more qualified meetings without hiring more SDRs.\n\nWorth a quick chat about how you plan for it?\n\nAlex",
      personalized_claims: [{ text: "With Dana Ortiz joined as VP of Marketing at Acme", evidence_id: 21 }], used_evidence_ids: [21],
    });
    expect(codes(out, c)).not.toContain("claim_unsupported");
  });
});

describe("validators: each rule rejects what it should", () => {
  const rule: [string, GenerationOutput, string][] = [
    ["placeholder", body("Hoping to help {{company}} book more meetings. Interested in a chat about it?"), "unresolved_placeholder"],
    ["bracket placeholder", body("Hoping to help [Company] book more qualified meetings. Interested in a chat about it?"), "unresolved_placeholder"],
    ["wrong greeting", goodOutput({ body: GOOD_BODY.replace("Hi Sarah", "Hi Michael") }), "wrong_recipient"],
    ["link", body("We help outbound teams book meetings, details at https://leadco.io/demo — worth a look at how you handle outbound?"), "disallowed_link"],
    ["bare domain", body("Take a look at leadco.io to see how we help outbound teams book more qualified meetings. Curious how you handle it?"), "disallowed_link"],
    ["email address", body("Reach me at alex@leadco.io if you want to talk about how outbound teams book more qualified meetings."), "disallowed_link"],
    ["spam wording", body("We help outbound teams book meetings. Act now, limited time, guaranteed results for your team. Interested?"), "banned_phrase"],
    ["fake familiarity", body("Following up on our call last week about how outbound teams book more qualified meetings. Free to continue?"), "banned_phrase"],
    ["mutual connection", body("A mutual connection suggested I reach out about outbound meetings for your sales team. Open to it?"), "banned_phrase"],
    ["flattery", body("We're impressed by your recent Slack integration launch. Curious how you handle outbound today?"), "banned_phrase"],
    ["embellishment", body("Acme has a seamless integration with the tools your sales team uses every day. Curious how you handle outbound today?"), "banned_phrase"],
    ["fake reply subject", goodOutput({ subject: "Re: our call" }), "fake_reply_subject"],
    ["too short", goodOutput({ body: "Hi Sarah,\n\nQuick question about outbound.\n\nAlex", personalized_claims: [], used_evidence_ids: [] }), "too_short"],
    ["too long", goodOutput({ body: `Hi Sarah,\n\n${"We help outbound teams book meetings. ".repeat(60)}`, personalized_claims: [], used_evidence_ids: [] }), "too_long"],
    ["empty subject", goodOutput({ subject: " " }), "empty_subject"],
    ["unknown evidence id in claims", goodOutput({ personalized_claims: [{ text: "Acme is hiring 4 sales roles", evidence_id: 999 }] }), "unknown_evidence"],
    ["unknown evidence id in used list", goodOutput({ used_evidence_ids: [11, 4242] }), "unknown_evidence"],
    ["claim not in body", goodOutput({ personalized_claims: [{ text: "Acme opened a Berlin office", evidence_id: 11 }] }), "claim_not_in_text"],
  ];
  it.each(rule)("%s", (_name, out, code) => {
    expect(codes(out)).toContain(code);
  });
});

/**
 * Spec acceptance: "validator catches 100% of injected hallucinations". Every draft below asserts something the
 * context does not support; each MUST produce at least one error. The clean controls in the section above guard
 * against the opposite failure (rejecting everything).
 */
describe("hallucination injection: every fabricated draft is rejected", () => {
  const cite = (text: string, id = 11) => ({ personalized_claims: [{ text, evidence_id: id }], used_evidence_ids: [id] });
  const injected: [string, GenerationOutput][] = [
    ["invented expansion, no claim", body("Congrats on the Germany expansion! Are you rethinking how your team handles outbound now?")],
    ["invented expansion, cited against unrelated evidence", body("Congrats on the Germany expansion! Curious how you handle outbound there.", cite("Congrats on the Germany expansion"))],
    ["invented funding", body("Congrats on your recent Series B. Most sales leaders then rethink outbound — is that you?")],
    ["funding amount cited on hiring evidence", body("Acme just raised $20M to grow. Curious how you plan to ramp outbound with it?", cite("Acme just raised $20M to grow"))],
    ["inflated number", body("I saw that Acme is hiring 40 sales roles. Curious how you plan to ramp them?", cite("Acme is hiring 40 sales roles"))],
    ["number inside a bigger number", body("I saw that Acme is hiring 14 sales roles. Curious how you plan to ramp them?", cite("Acme is hiring 14 sales roles"))],
    ["invented location move", body("I noticed you moved the team to Berlin recently. How does that change outbound for you?")],
    ["invented mutual connection", body("Our mutual connection Priya suggested I reach out about outbound at your company. Open to a chat?")],
    ["invented prior call", body("Following up on our call last week about outbound meetings. Do you have time this week?")],
    ["invented integration", body("Our platform integrates with Salesforce and HubSpot so your team ramps faster. Worth a chat?")],
    ["invented customers", body("Teams at Stripe and Shopify use us to book more meetings. Curious if outbound is a priority for you?")],
    ["invented metric about the sender", body("We increased reply rates by 43% for similar teams. Curious how you handle outbound today?")],
    ["invented competitor comparison", body("Unlike Outreach, we do not need any setup at all. Curious how you handle outbound today?")],
    ["invented person", body("I read Jane Doe's interview about how your team sells. Curious how you handle outbound today?")],
    ["invented product launch", body("You recently launched a new pricing page, and outbound teams often follow that with a push. Worth a chat?")],
    ["invented award", body("Congrats on winning the industry award for sales innovation. Curious how outbound fits in?")],
    ["invented leadership change", body("Congratulations on your promotion to VP Sales last month. Curious how you plan to ramp outbound?")],
    ["fake urgency", body("Only 2 spots left this month, so act now to book more qualified meetings. Interested in a chat?")],
    ["email address smuggled in", body("Book more qualified meetings — write me at alex@leadco.io whenever it suits you and your team.")],
    ["claim paraphrased into something the evidence never said", body("I saw that Acme is closing its sales team, which usually means outbound is broken. Curious?", cite("Acme is closing its sales team"))],
    ["claim citing a different company's evidence id", body("I saw that Globex is hiring 4 sales roles. Curious how you plan to ramp them?", cite("Globex is hiring 4 sales roles", 555))],
    ["inference riding behind a valid claim", goodOutput({ body: GOOD_BODY.replace("I saw that Acme is hiring 4 sales roles.", "I saw that Acme is hiring 4 sales roles, which suggests your outbound is under pressure.") })],
    ["presupposition inside a question", goodOutput({ body: GOOD_BODY.replace("Worth a quick chat about how you plan to ramp them?", "As you continue to enhance your expense management offerings for startups, would a quick chat help?") })],
    ["inference in its own sentence", body("Acme builds outbound analytics software that apparently serves multiple enterprise clients. Worth a chat?")],
    ["fluff assertion about the recipient's market", body("Acme provides outbound analytics software, which is essential in the ever-evolving revenue landscape. Worth a chat?")],
    ["inflated claim about the sender's product", body("We enhance team productivity and streamline forecasting accuracy for every revenue org. Is that useful?")],
    ["unlisted factual sentence beside a valid claim", goodOutput({ body: GOOD_BODY.replace("I saw that Acme is hiring 4 sales roles.", "I saw that Acme is hiring 4 sales roles. Your revenue grew 3x last year and you opened an office in Austin.") })],
  ];
  it.each(injected)("rejects: %s", (_name, out) => {
    expect(hasErrors(validateGeneration(out, ctx))).toBe(true);
  });
  it("catches 100% of the injected set (and there is a meaningful number of them)", () => {
    expect(injected.length).toBeGreaterThanOrEqual(20);
    const missed = injected.filter(([, out]) => !hasErrors(validateGeneration(out, ctx))).map(([n]) => n);
    expect(missed).toEqual([]);
  });
});

describe("claimSupported", () => {
  const known = new Set<string>();
  it("accepts a faithful paraphrase", () => {
    expect(claimSupported("hiring 4 sales roles","We're hiring: 4 open roles on our sales team", known).ok).toBe(true);
  });
  it("matches numbers as whole numbers", () => {
    expect(claimSupported("hiring 4 roles", "hiring 14 roles", known).ok).toBe(false);
    expect(claimSupported("raised 1,200 seats", "raised 1200 seats", known).ok).toBe(true);
  });
  it("rejects a claim with too little overlap", () => {
    expect(claimSupported("expanding into Germany", "We're hiring 4 sales roles", known).ok).toBe(false);
  });
});

describe("edited drafts: warnings, never blocks", () => {
  it("downgrades every problem to a warning", () => {
    const issues = validateEdit({ subject: "Congrats!", body: "Hi Sarah,\n\nCongrats on the Germany expansion! Are you rethinking how your team handles outbound now?\n\nAlex", claims: [], usedEvidenceIds: [] }, ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
  });
  it("drops a claim whose phrase was edited away instead of erroring", () => {
    const issues = validateEdit({ subject: "Hello", body: GOOD_BODY.replace("Acme is hiring 4 sales roles", "your team is growing"), claims: [{ text: "Acme is hiring 4 sales roles", evidence_id: 11 }], usedEvidenceIds: [11] }, ctx);
    expect(issues.map((i) => i.code)).not.toContain("claim_not_in_text");
  });
});

describe("sentencesOf / segmentBody", () => {
  it("splits on sentence ends and line breaks", () => {
    expect(sentencesOf("Hi Sarah,\n\nOne. Two? Three!")).toEqual(["Hi Sarah,", "One.", "Two?", "Three!"]);
  });
  it("highlights each evidence-backed phrase and leaves the rest plain", () => {
    const segs = segmentBody(GOOD_BODY, [{ text: "Acme is hiring 4 sales roles", evidenceId: 11 }]);
    expect(segs.filter((s) => s.evidenceId !== null)).toEqual([{ text: "Acme is hiring 4 sales roles", evidenceId: 11 }]);
    expect(segs.map((s) => s.text).join("")).toBe(GOOD_BODY);
  });
  it("finds a phrase across different whitespace/case, and ignores one that is gone", () => {
    const segs = segmentBody("a  ACME is   hiring b", [{ text: "acme is hiring", evidenceId: 1 }, { text: "not here", evidenceId: 2 }]);
    expect(segs.filter((s) => s.evidenceId !== null)).toHaveLength(1);
    expect(segs.map((s) => s.text).join("")).toBe("a  ACME is   hiring b");
  });
  it("keeps the earliest of overlapping phrases and never loses text", () => {
    const text = "we love outbound meetings today";
    const segs = segmentBody(text, [{ text: "love outbound", evidenceId: 1 }, { text: "outbound meetings", evidenceId: 2 }]);
    expect(segs.map((s) => s.text).join("")).toBe(text);
    expect(segs.filter((s) => s.evidenceId !== null).map((s) => s.evidenceId)).toEqual([1]);
  });
});
