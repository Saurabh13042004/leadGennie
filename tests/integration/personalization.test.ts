import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { baseIcp, drain, installFakeEngine, seedResearchableLead, setWorkspaceIcp } from "../helpers/intelligence";
import { enqueueLeadResearch } from "@/lib/intelligence/service";
import { setIntelligenceClient } from "@/lib/intelligence/client";
import { setLlmProvider } from "@/lib/ai/client";
import { LlmError } from "@/lib/ai/llm-types";
import { FakeLlm } from "@/lib/ai/fake";
import { approveDraft, editDraft, generateDraftForLead, getCurrentDraft, getDraft, getEditHistory, listDrafts, rejectDraft } from "@/lib/domain/personalization/drafts";
import { loadContext } from "@/lib/domain/personalization/context";
import { enqueueDraftGeneration, getWorkspaceTone, MAX_BULK_DRAFTS, setWorkspaceTone } from "@/lib/domain/personalization/service";
import { getResearchProgress } from "@/lib/intelligence/service";
import { TONE_GUIDANCE } from "@/lib/domain/personalization/tone";
import { AppError } from "@/lib/api/errors";

type W = { workspaceId: number; user: { id: number; email: string } };
let A: W;
let B: W;
const actor = (w: W) => ({ workspaceId: w.workspaceId, userId: w.user.id });
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];

/** Researches a lead through the real queue + fake engine so the evidence rows are exactly what production writes. */
async function researchedLead(w: W, opts: Parameters<typeof seedResearchableLead>[1] = {}) {
  installFakeEngine();
  const seeded = await seedResearchableLead(w.workspaceId, opts);
  await enqueueLeadResearch(actor(w), [seeded.leadId]);
  await drain();
  return seeded;
}

async function verifiedEvidence(workspaceId: number, leadId: number) {
  return sql`select id, claim, snippet from evidence where workspace_id = ${workspaceId} and lead_id = ${leadId} and verified order by id`;
}

const greeting = "Hi Sarah,\n\n";
function draftFrom(claimText: string, evidenceId: number, extra = "") {
  return {
    subject: "Ramping your team",
    body: `${greeting}I saw that ${claimText}. ${extra}We help outbound teams book more qualified meetings without hiring more SDRs.\n\nWorth a quick chat about how you handle outbound today?\n\nAlex`,
    angle: "Growth", used_evidence_ids: [evidenceId], personalized_claims: [{ text: claimText, evidence_id: evidenceId }], confidence: 0.8,
  };
}
const halluc = {
  subject: "Congrats on the expansion", angle: "Expansion", used_evidence_ids: [], personalized_claims: [], confidence: 0.9,
  body: `${greeting}Congrats on the Germany expansion! We help outbound teams book more qualified meetings without hiring more SDRs.\n\nWorth a quick chat about how you handle outbound today?\n\nAlex`,
};

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  for (const w of [A, B]) await setWorkspaceIcp(w.workspaceId, baseIcp, "We help outbound teams book more qualified meetings without hiring more SDRs.");
  await sql`update users set name = 'Alex Rivera' where id = ${A.user.id}`;
  setSession({ workspaceId: A.workspaceId, userId: A.user.id, email: A.user.email, role: "owner" });
});
afterEach(() => {
  setLlmProvider(null);
  setIntelligenceClient(null);
});

describe("generation (context → model → validators → storage)", () => {
  it("stores a clean draft with its claims, audit row, usage, run and activity", async () => {
    const { leadId } = await researchedLead(A);
    const ev = await verifiedEvidence(A.workspaceId, leadId);
    expect(ev.length).toBeGreaterThan(0);
    const e = ev[0];
    const llm = new FakeLlm().json(draftFrom(String(e.claim), Number(e.id)));
    setLlmProvider(llm);

    const d = await generateDraftForLead(actor(A), leadId);
    expect(d).toMatchObject({ status: "draft", attempts: 1, tone: "concise", isCurrent: true });
    expect(d.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(d.claims).toEqual([{ text: String(e.claim), evidenceId: Number(e.id) }]);
    expect(d.evidence[Number(e.id)].sourceUrl).toMatch(/^https?:\/\//);
    expect(d.originalBody).toBe(d.body);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0].prompt).toContain(`<evidence id="${e.id}"`);

    const gen = await one(sql`select * from message_generations where workspace_id = ${A.workspaceId}`);
    expect(gen).toMatchObject({ channel: "email", output_body: d.body, sender_company: null });
    expect(await one(sql`select generation_id from message_drafts where id = ${d.id}`)).toMatchObject({ generation_id: gen.id });
    expect(Number((await one(sql`select count(*)::int as n from usage_records where workspace_id = ${A.workspaceId} and ref_type = 'message_draft'`)).n)).toBe(1);
    expect((await one(sql`select status from agent_runs where workspace_id = ${A.workspaceId} and type = 'personalize_lead'`)).status).toBe("completed");
    expect((await one(sql`select type from activities where workspace_id = ${A.workspaceId} and type = 'draft.generated'`)).type).toBe("draft.generated");
  });

  it("a hallucinating model is rejected, retried once with the checker's errors, then stored as failed_validation", async () => {
    const { leadId } = await researchedLead(A);
    const llm = new FakeLlm().json(halluc);
    setLlmProvider(llm);
    const d = await generateDraftForLead(actor(A), leadId);
    expect(d.status).toBe("failed_validation");
    expect(d.attempts).toBe(2);
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].prompt).toContain("YOUR PREVIOUS DRAFT WAS REJECTED");
    expect(d.issues.some((i) => i.severity === "error" && (i.code === "unknown_entity" || i.code === "unsupported_claim"))).toBe(true);
    // never silently replaced by a "safe" fallback: what is stored is the model's own (rejected) text
    expect(d.body).toContain("Germany");
  });

  it("recovers on the regeneration when the second attempt is clean", async () => {
    const { leadId } = await researchedLead(A);
    const e = (await verifiedEvidence(A.workspaceId, leadId))[0];
    setLlmProvider(new FakeLlm().json(halluc).json(draftFrom(String(e.claim), Number(e.id))));
    const d = await generateDraftForLead(actor(A), leadId);
    expect(d).toMatchObject({ status: "draft", attempts: 2 });
    expect(d.body).not.toContain("Germany");
  });

  it("invalid model JSON is never persisted", async () => {
    const { leadId } = await researchedLead(A);
    setLlmProvider(new FakeLlm().json({ subject: "x" })); // missing every other field, twice
    await expect(generateDraftForLead(actor(A), leadId)).rejects.toThrow(LlmError);
    expect(Number((await one(sql`select count(*)::int as n from message_drafts`)).n)).toBe(0);
    expect((await one(sql`select status from agent_runs where type = 'personalize_lead'`)).status).toBe("failed");
  });

  it("a lead with no evidence still gets an honest, valid, generic note (not blocked, not fabricated)", async () => {
    const { leadId } = await seedResearchableLead(A.workspaceId, { name: "Sarah Chen" });
    const llm = new FakeLlm().json({
      subject: "Quick question about outbound", angle: "Generic", used_evidence_ids: [], personalized_claims: [], confidence: 0.2,
      body: `${greeting}I work with outbound teams and wanted to ask how you currently book meetings. We help outbound teams book more qualified meetings without hiring more SDRs.\n\nIs that on your radar this quarter?\n\nAlex`,
    });
    setLlmProvider(llm);
    const d = await generateDraftForLead(actor(A), leadId);
    expect(d.status).toBe("draft");
    expect(d.claims).toEqual([]);
    expect(d.notes?.join(" ")).toMatch(/No verified evidence/);
    expect(llm.calls[0].prompt).toContain("there is no verified evidence for this lead");
  });

  it("a claim citing evidence the lead doesn't have (another workspace's, or unverified) is rejected", async () => {
    const { leadId } = await researchedLead(A);
    const other = await researchedLead(B);
    const foreign = (await verifiedEvidence(B.workspaceId, other.leadId))[0];
    setLlmProvider(new FakeLlm().json(draftFrom(String(foreign.claim), Number(foreign.id))));
    const d = await generateDraftForLead(actor(A), leadId);
    expect(d.status).toBe("failed_validation");
    expect(d.issues.map((i) => i.code)).toContain("unknown_evidence");
  });

  it("buildContext excludes unverified evidence and evidence from other workspaces or superseded research", async () => {
    const { leadId } = await researchedLead(A);
    const before = await loadContext(A.workspaceId, A.user.id, leadId);
    expect(before.evidence.length).toBeGreaterThan(0);
    await sql`update evidence set verified = false where workspace_id = ${A.workspaceId} and lead_id = ${leadId}`;
    expect((await loadContext(A.workspaceId, A.user.id, leadId)).evidence).toEqual([]);
    await sql`update evidence set verified = true where workspace_id = ${A.workspaceId} and lead_id = ${leadId}`;
    await sql`update lead_research set is_current = false where workspace_id = ${A.workspaceId} and lead_id = ${leadId}`;
    expect((await loadContext(A.workspaceId, A.user.id, leadId)).evidence).toEqual([]);
    await expect(loadContext(B.workspaceId, B.user.id, leadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uses the workspace tone by default and an explicit tone when given", async () => {
    const { leadId } = await researchedLead(A);
    const e = (await verifiedEvidence(A.workspaceId, leadId))[0];
    const llm = new FakeLlm().json(draftFrom(String(e.claim), Number(e.id)));
    setLlmProvider(llm);
    await setWorkspaceTone(A.workspaceId, "formal");
    expect(await getWorkspaceTone(A.workspaceId)).toBe("formal");
    const d1 = await generateDraftForLead(actor(A), leadId);
    expect(d1.tone).toBe("formal");
    expect(llm.calls[0].prompt).toContain(TONE_GUIDANCE.formal);
    const d2 = await generateDraftForLead(actor(A), leadId, { tone: "direct" });
    expect(d2.tone).toBe("direct");
    expect(llm.calls[1].prompt).toContain(TONE_GUIDANCE.direct);
    expect(llm.calls[1].prompt).not.toContain(TONE_GUIDANCE.formal);
  });

  it("regenerating keeps the old draft as history and exactly one draft is current", async () => {
    const { leadId } = await researchedLead(A);
    const e = (await verifiedEvidence(A.workspaceId, leadId))[0];
    setLlmProvider(new FakeLlm().json(draftFrom(String(e.claim), Number(e.id))));
    const first = await generateDraftForLead(actor(A), leadId);
    const second = await generateDraftForLead(actor(A), leadId);
    expect(second.id).not.toBe(first.id);
    expect((await getDraft(A.workspaceId, first.id))!.isCurrent).toBe(false);
    expect((await getCurrentDraft(A.workspaceId, leadId))!.id).toBe(second.id);
    expect(Number((await one(sql`select count(*)::int as n from message_drafts where lead_id = ${leadId}`)).n)).toBe(2);
  });
});

describe("edit, approve, reject", () => {
  async function cleanDraft() {
    const { leadId } = await researchedLead(A);
    const e = (await verifiedEvidence(A.workspaceId, leadId))[0];
    setLlmProvider(new FakeLlm().json(draftFrom(String(e.claim), Number(e.id))));
    return { leadId, e, draft: await generateDraftForLead(actor(A), leadId) };
  }

  it("editing keeps the original, logs the change, re-validates (warn, don't block) and needs re-approval", async () => {
    const { draft } = await cleanDraft();
    const approved = await approveDraft(actor(A), draft.id);
    expect(approved.status).toBe("approved");

    const edited = await editDraft(actor(A), draft.id, { subject: "Hello", body: `${greeting}Congrats on the Germany expansion! We help outbound teams book more qualified meetings without hiring more SDRs. Worth a chat about outbound today?\n\nAlex` });
    expect(edited.status).toBe("edited");
    expect(edited.approvedAt).toBeNull();
    expect(edited.originalBody).toBe(draft.originalBody);
    expect(edited.originalSubject).toBe(draft.originalSubject);
    expect(edited.issues.length).toBeGreaterThan(0);
    expect(edited.issues.every((i) => i.severity === "warning")).toBe(true);
    expect(edited.claims).toEqual([]); // the sourced phrase was edited away, so no highlight remains

    const history = await getEditHistory(A.workspaceId, draft.id);
    expect(history).toHaveLength(1);
    expect(history[0].beforeBody).toBe(draft.body);
    expect(history[0].afterSubject).toBe("Hello");
    // the user owns their edit: approving it is allowed, and the warnings stay on record
    expect((await approveDraft(actor(A), draft.id)).status).toBe("approved");
    expect((await one(sql`select metadata from activities where type = 'draft.approved' order by id desc limit 1`)).metadata).toMatchObject({ edited: true });
  });

  it("rejects empty edits", async () => {
    const { draft } = await cleanDraft();
    await expect(editDraft(actor(A), draft.id, { subject: "", body: "x" })).rejects.toBeInstanceOf(AppError);
    await expect(editDraft(actor(A), draft.id, { subject: "x", body: "   " })).rejects.toBeInstanceOf(AppError);
  });

  it("a failed-validation draft cannot be approved, but a human edit can rescue it", async () => {
    const { leadId } = await researchedLead(A);
    setLlmProvider(new FakeLlm().json(halluc));
    const bad = await generateDraftForLead(actor(A), leadId);
    await expect(approveDraft(actor(A), bad.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const fixed = await editDraft(actor(A), bad.id, { subject: "Outbound question", body: `${greeting}We help outbound teams book more qualified meetings without hiring more SDRs. Worth a quick chat about how you handle outbound today?\n\nAlex` });
    expect(fixed.status).toBe("edited");
    expect(fixed.issues).toEqual([]);
    expect((await approveDraft(actor(A), bad.id)).status).toBe("approved");
  });

  it("a clean draft is re-checked at approval: if its evidence stopped being verified, approval is refused", async () => {
    const { leadId, draft } = await cleanDraft();
    await sql`update evidence set verified = false where workspace_id = ${A.workspaceId} and lead_id = ${leadId}`;
    await expect(approveDraft(actor(A), draft.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getDraft(A.workspaceId, draft.id))!.status).toBe("failed_validation");
  });

  it("reject sets the status; a rejected draft can't be approved; a replaced draft can't be edited", async () => {
    const { leadId, draft } = await cleanDraft();
    expect((await rejectDraft(actor(A), draft.id)).status).toBe("rejected");
    await expect(approveDraft(actor(A), draft.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await generateDraftForLead(actor(A), leadId);
    await expect(editDraft(actor(A), draft.id, { subject: "a", body: "b" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("is tenant-isolated: another workspace can't see, edit, approve or reject a draft", async () => {
    const { draft } = await cleanDraft();
    expect(await getDraft(B.workspaceId, draft.id)).toBeNull();
    for (const fn of [
      () => editDraft(actor(B), draft.id, { subject: "a", body: "b" }),
      () => approveDraft(actor(B), draft.id),
      () => rejectDraft(actor(B), draft.id),
    ]) await expect(fn()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listDrafts(B.workspaceId)).items).toEqual([]);
    expect((await getEditHistory(B.workspaceId, draft.id))).toEqual([]);
  });

  it("lists drafts by status with counts (needs review = draft + edited)", async () => {
    const { leadId, draft } = await cleanDraft();
    let q = await listDrafts(A.workspaceId, { status: "needs_review" });
    expect(q.items.map((i) => i.id)).toEqual([draft.id]);
    expect(q.counts).toMatchObject({ draft: 1, approved: 0 });
    await approveDraft(actor(A), draft.id);
    q = await listDrafts(A.workspaceId, { status: "needs_review" });
    expect(q.items).toEqual([]);
    expect((await listDrafts(A.workspaceId, { status: "approved" })).items[0]).toMatchObject({ leadId, status: "approved", errorCount: 0 });
  });
});

describe("bulk generation as jobs", () => {
  it("drafts for many leads with per-lead failures visible and the rest unaffected", async () => {
    installFakeEngine();
    const leads: number[] = [];
    for (const [i, name] of ["Sarah Chen", "Tom Baker", "Priya Nair"].entries()) {
      const l = await seedResearchableLead(A.workspaceId, { name, company: `Co${i}`, domain: `co${i}.example` });
      leads.push(l.leadId);
    }
    await enqueueLeadResearch(actor(A), leads);
    await drain();

    // Tom's draft hits a provider quota error; the others succeed.
    setLlmProvider(
      new FakeLlm().json((prompt: string) => {
        if (prompt.includes("First name: Tom")) throw new LlmError("OpenAI API quota exceeded — check your OpenAI billing and usage limits.");
        const first = /First name: (\w+)/.exec(prompt)![1];
        return { subject: "Outbound question", angle: "generic", used_evidence_ids: [], personalized_claims: [], confidence: 0.3,
          body: `Hi ${first},\n\nI work with outbound teams and wanted to ask how you currently book meetings. We help outbound teams book more qualified meetings without hiring more SDRs.\n\nIs that on your radar this quarter?\n\nAlex` };
      }),
    );
    const res = await enqueueDraftGeneration(actor(A), leads);
    expect(res.enqueued).toHaveLength(3);
    await drain();

    const progress = await getResearchProgress(A.workspaceId, res.agentRunId);
    expect(progress).toMatchObject({ total: 3, succeeded: 2, failed: 1, finished: true });
    expect(progress.errors[0].message).toMatch(/quota exceeded/);
    const drafts = await listDrafts(A.workspaceId);
    expect(drafts.items).toHaveLength(2);
    expect(drafts.items.every((d) => d.status === "draft")).toBe(true);
    expect((await one(sql`select status from agent_runs where id = ${res.agentRunId}`)).status).toBe("completed");
  });

  it("is capped, validates input, skips unknown leads, and never double-queues a lead", async () => {
    await expect(enqueueDraftGeneration(actor(A), [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(enqueueDraftGeneration(actor(A), Array.from({ length: MAX_BULK_DRAFTS + 1 }, (_, i) => i + 1))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const other = await seedResearchableLead(B.workspaceId, { company: "Other", domain: "other.example" });
    const first = await enqueueDraftGeneration(actor(A), [leadId, other.leadId, 999999]);
    expect(first.enqueued.map((e) => e.leadId)).toEqual([leadId]);
    expect(first.skipped.map((s) => s.reason).sort()).toEqual(["not_found", "not_found"]);
    const again = await enqueueDraftGeneration(actor(A), [leadId]);
    expect(again.enqueued).toEqual([]);
    expect(again.skipped).toEqual([{ leadId, reason: "already_running" }]);
  });

  it("passes the chosen tone and news toggle through to each job", async () => {
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const llm = new FakeLlm().json({
      subject: "Outbound question", angle: "g", used_evidence_ids: [], personalized_claims: [], confidence: 0.3,
      body: `${greeting}I work with outbound teams and wanted to ask how you book meetings. We help outbound teams book more qualified meetings without hiring more SDRs.\n\nIs that on your radar?\n\nAlex`,
    });
    setLlmProvider(llm);
    await enqueueDraftGeneration(actor(A), [leadId], { tone: "friendly", includeNews: true });
    await drain();
    expect(llm.calls[0].prompt).toContain(TONE_GUIDANCE.friendly);
    expect((await getCurrentDraft(A.workspaceId, leadId))!).toMatchObject({ tone: "friendly", includeNews: true });
  });
});
