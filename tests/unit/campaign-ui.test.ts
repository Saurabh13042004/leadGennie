import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
import CampaignCard from "@/components/campaigns/CampaignCard";
import ApprovalSummary from "@/components/campaigns/detail/ApprovalSummary";
import CampaignLeadsTable from "@/components/campaigns/detail/CampaignLeadsTable";
import ChecklistPanel from "@/components/campaigns/builder/ChecklistPanel";
import { StatusBadge } from "@/components/campaigns/builder/ui";
import { CAMPAIGN_STATUS } from "@/components/campaigns/campaign-status";
import type { CampaignListItem } from "@/lib/domain/campaigns/read-model";
import { CAMPAIGN_STATUSES, EXCLUSION_REASONS } from "@/lib/domain/campaigns/types";

/** Render smoke tests: these render on the server, so a bad prop or null access crashes the page. */
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const item = (over: Partial<CampaignListItem> = {}): CampaignListItem => ({
  id: 7, name: "Q4 outbound", status: "running", sendModel: "leads", audienceSize: 40, excluded: 3, sent: 12, replied: null,
  nextSendAt: "2026-09-26T09:00:00.000Z", steps: 4, approvalId: 1, createdAt: "2026-09-20T00:00:00.000Z", ...over,
});

describe("campaign list card", () => {
  it("shows real counts and never a reply rate; replies show — until tracked", () => {
    const out = html(h("ul", null, h(CampaignCard, { campaign: item(), canApprove: true })));
    expect(out).toContain("Q4 outbound");
    expect(out).toContain(">12<");
    expect(out).toContain(">—<");
    expect(out).not.toMatch(/%/);
    expect(out).toContain('href="/dashboard/campaigns/7"');
  });
  it("a draft shows no counts at all (nothing has happened yet)", () => {
    const out = html(h("ul", null, h(CampaignCard, { campaign: item({ status: "draft", sent: 0, audienceSize: 0, nextSendAt: null }), canApprove: true })));
    expect(out.match(/>—</g)?.length).toBe(4); // leads, sent, replies, next email
    expect(out).toContain("Draft");
    expect(out).toContain('href="/dashboard/campaigns/7/edit"');
  });
  it("pending approval offers approve/reject only to owners/admins", () => {
    const pending = item({ status: "pending_approval", nextSendAt: null });
    expect(html(h("ul", null, h(CampaignCard, { campaign: pending, canApprove: true })))).toContain("Approve");
    const member = html(h("ul", null, h(CampaignCard, { campaign: pending, canApprove: false })));
    expect(member).not.toContain("Approve");
    expect(member).toContain("Waiting on owner/admin");
  });
  it("every status has a label", () => {
    for (const s of CAMPAIGN_STATUSES) expect(html(h(StatusBadge, { status: s }))).toContain(CAMPAIGN_STATUS[s].label);
  });
});

describe("approval summary", () => {
  it("shows what the approver signs off on, then who decided and when", () => {
    const base = { id: 1, requestedBy: "Alex", note: null, payload: {
      totalLeads: 3, steps: [{ order: 1 }, { order: 2 }], fromEmail: "me@x.example", exclusions: { do_not_contact: 2 },
      sampleMessage: { leadName: "Sarah Chen", subject: "Question for Acme", body: "Hi Sarah" }, warnings: ["Low limit"],
    } };
    const pending = html(h(ApprovalSummary, { approval: { ...base, status: "pending", decidedBy: null, decidedAt: null } }));
    expect(pending).toContain("waiting for an owner or admin");
    expect(pending).toContain("On the Do Not Contact list (2)");
    expect(pending).toContain("Question for Acme");
    const approved = html(h(ApprovalSummary, { approval: { ...base, status: "approved", decidedBy: "Priya", decidedAt: "2026-09-25T10:00:00.000Z" } }));
    expect(approved).toContain("Approved by Priya");
  });
  it("survives an empty (legacy) payload", () => {
    expect(() => html(h(ApprovalSummary, { approval: { id: 1, status: "approved", requestedBy: null, decidedBy: null, decidedAt: null, note: null, payload: {} } }))).not.toThrow();
  });
});

describe("per-lead table", () => {
  it("lists state, progress and stop reasons, with status filters", () => {
    const out = html(h(CampaignLeadsTable, {
      id: 7, filter: null, steps: 4, counts: { active: 1, blocked: 1 },
      rows: [
        { leadId: 1, name: "Sarah Chen", email: "s@a.example", status: "active", currentStep: 1, nextActionAt: "2026-09-28T09:00:00.000Z", stopReason: null, sent: 1 },
        { leadId: 2, name: "Tom Baker", email: null, status: "blocked", currentStep: 0, nextActionAt: null, stopReason: "Unsubscribed", sent: 0 },
      ],
    }));
    expect(out).toContain("1/4");
    expect(out).toContain("Unsubscribed");
    expect(out).toContain("no email");
    expect(out).toContain('href="/dashboard/campaigns/7?status=blocked"');
  });
  it("explains an empty table", () => {
    expect(html(h(CampaignLeadsTable, { id: 7, filter: null, steps: 4, counts: {}, rows: [] }))).toContain("enrolled when the campaign launches");
  });
});

describe("checklist", () => {
  const readiness = (blockers: { section: "basics"; message: string }[]) => ({
    blockers, warnings: [{ section: "sequence" as const, message: "Step 1: spammy" }], willEnroll: 12,
    audience: { candidates: 15, eligible: 12, exclusions: Object.fromEntries(EXCLUSION_REASONS.map((r) => [r, 0])) as never, samples: {}, eligibleSample: [], capped: false, notes: [] },
    mailbox: null, drafts: { personalized: false, approved: 0, needsReview: 0, failed: 0, missing: 0, usingFallback: 0, blockingLeads: [] }, overTotalLimit: 0,
  });
  it("names each blocker, or says it's ready", () => {
    const noop = () => undefined;
    expect(html(h(ChecklistPanel, { readiness: readiness([{ section: "basics", message: "Pick a sending mailbox." }]), onGoTo: noop }))).toContain("Pick a sending mailbox.");
    const ready = html(h(ChecklistPanel, { readiness: readiness([]), onGoTo: noop }));
    expect(ready).toContain("Ready to submit for approval");
    expect(ready).toContain(">12<");
    expect(ready).toContain("Step 1: spammy");
  });
});
