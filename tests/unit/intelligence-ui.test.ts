import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScoreChip from "@/components/leads/ScoreChip";
import ResearchStatusBadge from "@/components/leads/ResearchStatusBadge";
import ScoreHeader from "@/components/leads/intel/ScoreHeader";
import WhyFit from "@/components/leads/intel/WhyFit";
import SignalsPanel from "@/components/leads/intel/SignalsPanel";
import Narrative from "@/components/leads/intel/Narrative";
import EvidencePanel from "@/components/leads/intel/EvidencePanel";
import UnverifiedPanel from "@/components/leads/intel/UnverifiedPanel";
import CompanyCard from "@/components/leads/intel/CompanyCard";
import type { EvidenceView, LeadIntelligence, SignalView } from "@/lib/intelligence/read-model";

/** Render smoke tests: these components run on the server, so a bad prop or null access crashes the whole page. */

const evidence = (over: Partial<EvidenceView> = {}): EvidenceView => ({
  id: 1, claim: "Acme has 8 open SDR roles", sourceUrl: "https://acme.example/careers", sourceTitle: "Careers — Acme", sourceType: "careers",
  snippet: "Sales Development Representative (8 openings)", capturedAt: "2026-09-24T10:00:00.000Z", verified: true, confidence: 0.94, notes: [], signalId: 1, ...over,
});
const signal = (over: Partial<SignalView> = {}): SignalView => ({
  id: 1, type: "HIRING", title: "Hiring 8 SDRs", description: "8 open roles", detectedAt: "2026-09-20", confidence: 0.94, verified: true, conflictsWith: [], evidence: [evidence()], ...over,
});
const research: NonNullable<LeadIntelligence["research"]> = {
  id: 1, status: "complete", icpConfidence: 0.82, whyContact: "Acme sells outbound tooling.", whyNow: "Acme has 8 open SDR roles.", whyPerson: "Sarah owns sales development.",
  potentialProblem: "Rapid growth may strain pipeline.", recommendedAngle: "Lead with qualified pipeline per SDR.", insufficientEvidence: false,
  whyFit: [{ criterion: "industry", status: "met", text: "Industry matches", evidenceIds: [3] }, { criterion: "geography", status: "unknown", text: "Location unknown", evidenceIds: [] }],
  unknowns: ["funding history"], warnings: [], evidenceIds: [1], createdAt: "2026-09-24T10:00:00.000Z",
};
const intel = (over: Partial<LeadIntelligence> = {}): LeadIntelligence => ({
  leadId: 1, researchStatus: "done", researchedAt: "2026-09-24T10:00:00.000Z", icpScore: 91, intentScore: 64, qualified: true, lastError: null, research,
  verifiedSignals: [signal()], unverifiedSignals: [], otherEvidence: [], verifiedSourceCount: 1, company: null, candidates: [], history: [], ...over,
});
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("score + status", () => {
  it("never renders an unresearched lead as 0", () => {
    expect(html(h(ScoreChip, { score: null }))).toContain("—");
    expect(html(h(ScoreChip, { score: null }))).not.toContain(">0<");
    expect(html(h(ScoreChip, { score: 91, qualified: true }))).toMatch(/91/);
    expect(html(h(ScoreChip, { score: 0 }))).toContain(">0<"); // a real zero is shown as a zero
  });
  it("labels every research status", () => {
    for (const s of ["none", "queued", "running", "done", "partial", "failed"]) expect(html(h(ResearchStatusBadge, { status: s }))).toBeTruthy();
    expect(html(h(ResearchStatusBadge, { status: "running" }))).toContain("Researching");
  });
  it("ScoreHeader shows score, threshold state, confidence caveat and intent", () => {
    const out = html(h(ScoreHeader, { intel: intel({ research: { ...research, icpConfidence: 0.5 } }) }));
    expect(out).toContain("91");
    expect(out).toContain("Qualified");
    expect(out).toContain("some criteria are unknown");
    expect(html(h(ScoreHeader, { intel: intel({ qualified: false, icpScore: 40 }) }))).toContain("Below threshold");
    // Mostly-unchecked criteria are not a verdict on the lead: say so instead of "Below threshold".
    const thin = html(h(ScoreHeader, { intel: intel({ qualified: false, icpScore: 15, research: { ...research, icpConfidence: 0.49 } }) }));
    expect(thin).toContain("Needs more evidence");
    expect(thin).not.toContain("Below threshold");
    expect(html(h(ScoreHeader, { intel: intel({ qualified: false, icpScore: 40, research: { ...research, icpConfidence: 0.9 } }) }))).toContain("Below threshold");
  });
});

describe("evidence-backed sections", () => {
  it("WhyFit renders each criterion and links to its evidence", () => {
    const out = html(h(WhyFit, { items: research.whyFit }));
    expect(out).toContain("Industry matches");
    expect(out).toContain('href="#evidence-3"');
    expect(html(h(WhyFit, { items: [] }))).toBe("");
  });
  it("SignalsPanel lists verified signals with source links, and is honest when there are none", () => {
    const out = html(h(SignalsPanel, { signals: [signal()] }));
    expect(out).toContain("Hiring 8 SDRs");
    expect(out).toContain('href="https://acme.example/careers"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(html(h(SignalsPanel, { signals: [] }))).toContain("No recent, verified buying signals");
  });
  it("Narrative labels the hypothesis as a hypothesis and admits insufficient evidence", () => {
    const out = html(h(Narrative, { research }));
    expect(out).toContain("hypothesis, not a fact");
    expect(out).toContain("Why now");
    const thin = html(h(Narrative, { research: { ...research, insufficientEvidence: true, whyContact: "", whyPerson: "", potentialProblem: "", whyNow: "" } }));
    expect(thin).toContain("Not enough verified evidence");
    expect(thin).toContain("No recent verified triggers found.");
  });
  it("EvidencePanel quotes the source, anchors each item, and handles the empty case", () => {
    const out = html(h(EvidencePanel, { evidence: [evidence()], sourceCount: 1 }));
    expect(out).toContain('id="evidence-1"');
    expect(out).toContain("Sales Development Representative (8 openings)");
    expect(out).toContain("94% verified");
    expect(html(h(EvidencePanel, { evidence: [], sourceCount: 0 }))).toContain("nothing is guessed");
  });
  it("UnverifiedPanel is collapsed, explains why, and renders nothing when empty", () => {
    const u = signal({ id: 2, verified: false, title: "Series B (unverified)", evidence: [evidence({ verified: false, notes: ["entity_match: different company"] })] });
    const out = html(h(UnverifiedPanel, { signals: [u] }));
    expect(out).toContain("<details");
    expect(out).not.toContain("<details open");
    expect(out).toContain("Unverified — not used");
    expect(out).toContain("entity_match: different company");
    expect(html(h(UnverifiedPanel, { signals: [] }))).toBe("");
  });
  it("CompanyCard shows unknown fields as unknown, never blank or invented", () => {
    const out = html(h(CompanyCard, { company: { id: 4, name: "Acme", domain: null, industry: null, employeeCount: 1200, location: null, description: null } }));
    expect(out).toContain("1,200");
    expect(out.match(/unknown/g)?.length).toBe(3);
  });
});

describe("hostile content is inert", () => {
  it("escapes markup in claims, snippets, titles and notes (XSS)", () => {
    const evil = "<script>alert(1)</script><img src=x onerror=alert(2)>";
    const out = html(h(EvidencePanel, { evidence: [evidence({ claim: evil, snippet: evil, sourceTitle: evil })], sourceCount: 1 }))
      + html(h(SignalsPanel, { signals: [signal({ title: evil, description: evil })] }))
      + html(h(Narrative, { research: { ...research, whyNow: evil, recommendedAngle: evil } }));
    expect(out).not.toContain("<script>");
    expect(out).not.toMatch(/<img[^>]+onerror/);
    expect(out).toContain("&lt;script&gt;");
  });
  it("a non-http source URL can't become a clickable javascript: link even if one reached the read model", () => {
    // persistence rejects these; the renderer must not be the only defense to rely on, but it must not crash either
    const out = html(h(SignalsPanel, { signals: [signal({ evidence: [evidence({ sourceUrl: "not a url" })] })] }));
    expect(out).toContain("not a url");
  });
});
