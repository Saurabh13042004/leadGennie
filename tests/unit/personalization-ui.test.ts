import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DraftBody from "@/components/leads/draft/DraftBody";
import DraftPanel from "@/components/leads/draft/DraftPanel";
import ToneSetting from "@/components/settings/ToneSetting";
import type { DraftView } from "@/lib/domain/personalization/drafts";
import { GOOD_BODY } from "../helpers/personalization";

/** Render smoke tests: these components render on the server first, so a bad prop or null access crashes the page. */

const evidence = { 11: { id: 11, claim: "Acme is hiring 4 sales roles", snippet: "We're hiring: 4 open roles on our sales team.", sourceUrl: "https://acme.example/careers", sourceTitle: "Careers at Acme", capturedAt: "2026-09-20T00:00:00.000Z" } };
const draft = (over: Partial<DraftView> = {}): DraftView => ({
  id: 1, leadId: 1, leadName: "Sarah Chen", company: "Acme", stepIndex: 0, status: "draft", subject: "Ramping your new sales hires", body: GOOD_BODY,
  originalSubject: "Ramping your new sales hires", originalBody: GOOD_BODY, angle: "New hires", tone: "concise", includeNews: false,
  claims: [{ text: "Acme is hiring 4 sales roles", evidenceId: 11 }], issues: [], attempts: 1, confidence: 0.8, model: "gpt-4o-mini", promptVersion: "cold-email/v1",
  createdAt: "2026-09-25T00:00:00.000Z", updatedAt: "2026-09-25T00:00:00.000Z", approvedAt: null, isCurrent: true, evidence, ...over,
});
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("DraftBody: evidence-linked highlights", () => {
  it("links each sourced phrase to its source and shows the verified snippet on hover/focus", () => {
    const out = html(h(DraftBody, { draft: draft() }));
    expect(out).toContain('href="https://acme.example/careers"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain(">Acme is hiring 4 sales roles</a>");
    expect(out).toContain("We&#x27;re hiring: 4 open roles on our sales team.");
    expect(out).toContain("Verified evidence");
    expect(out).toContain("group-hover:block");
    expect(out).toContain("group-focus-within:block");
  });

  it("renders unsourced text plainly and never links a claim whose evidence is missing", () => {
    const out = html(h(DraftBody, { draft: draft({ evidence: {} }) }));
    expect(out).not.toContain("<a ");
    expect(out).toContain("Acme is hiring 4 sales roles");
  });

  it("escapes hostile text instead of injecting markup", () => {
    const out = html(h(DraftBody, { draft: draft({ body: "Hi <img src=x onerror=alert(1)>", claims: [] }) }));
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });
});

describe("DraftPanel", () => {
  const props = { leadId: 1, defaultTone: "concise" as const, canEdit: true, hasEvidence: true };

  it("offers Generate when there's no draft, and explains a lead with no evidence", () => {
    const out = html(h(DraftPanel, { ...props, initial: null, hasEvidence: false }));
    expect(out).toContain("Generate email");
    expect(out).toContain("no verified evidence yet");
    expect(out).toContain("Nothing is sent from here");
  });

  it("shows a clean draft as passing, with Approve / Edit / Reject and the audit line", () => {
    const out = html(h(DraftPanel, { ...props, initial: draft() }));
    expect(out).toContain("Needs review");
    expect(out).toContain("Passed all checks");
    expect(out).toContain("Approve draft");
    expect(out).toContain("Regenerate");
    expect(out).toContain("1 sourced phrase");
    expect(out).toContain("first pass");
  });

  it("a failed draft says why and can't be approved", () => {
    const out = html(h(DraftPanel, { ...props, initial: draft({ status: "failed_validation", issues: [{ code: "unknown_entity", severity: "error", message: "“Berlin” is named but not in the verified context." }] }) }));
    expect(out).toContain("Failed checks");
    expect(out).toContain("broke the evidence rules");
    expect(out).toContain("“Berlin” is named but not in the verified context.");
    expect(out).not.toContain("Approve draft");
    expect(out).not.toContain("Passed all checks");
  });

  it("warnings from an edit are shown without blocking approval", () => {
    const out = html(h(DraftPanel, { ...props, initial: draft({ status: "edited", issues: [{ code: "long", severity: "warning", message: "The body is 140 words." }] }) }));
    expect(out).toContain("Edited");
    expect(out).toContain("The body is 140 words.");
    expect(out).toContain("Approve draft");
    expect(out).toContain("Show original");
  });

  it("viewers see the draft but no controls", () => {
    const out = html(h(DraftPanel, { ...props, canEdit: false, initial: draft() }));
    expect(out).toContain("Acme is hiring 4 sales roles");
    expect(out).not.toContain("Approve draft");
    expect(out).not.toContain("Regenerate");
    expect(out).not.toContain(">Edit<");
  });

  it("an approved draft offers no approve/reject again", () => {
    const out = html(h(DraftPanel, { ...props, initial: draft({ status: "approved", approvedAt: "2026-09-25T00:00:00.000Z" }) }));
    expect(out).toContain("Approved");
    expect(out).not.toContain("Approve draft");
  });
});

describe("ToneSetting", () => {
  it("shows every tone as a radio with its real guidance, and locks it for non-admins", () => {
    const out = html(h(ToneSetting, { initial: "formal", canEdit: false }));
    for (const t of ["concise", "friendly", "formal", "direct"]) expect(out).toContain(`>${t}<`);
    expect(out).toContain('aria-checked="true"');
    expect(out).toContain("Only workspace owners and admins can change this.");
    expect(out).toContain("disabled");
  });
});
