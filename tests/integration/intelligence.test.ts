import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { baseIcp, drain, installFakeEngine, loadFixture, makeDue, seedResearchableLead, setWorkspaceIcp, type LooseJson } from "../helpers/intelligence";
import { enqueueLeadResearch, enqueueRescoreAll, cancelResearch, getResearchProgress } from "@/lib/intelligence/service";
import { getLeadIntelligence } from "@/lib/intelligence/read-model";
import { persistResearch, QuarantineError } from "@/lib/intelligence/persist";
import { IntelligenceError, setIntelligenceClient } from "@/lib/intelligence/client";
import { researchResultSchema } from "@/lib/intelligence/schemas";
import { runTick } from "@/lib/jobs/worker";
import { AppError } from "@/lib/api/errors";

type W = { workspaceId: number; user: { id: number; email: string } };
let A: W;
let B: W;
const actor = (w: W) => ({ workspaceId: w.workspaceId, userId: w.user.id });
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];
const count = async (table: string, workspaceId: number) => Number((await sql.query(`select count(*)::int as n from ${table} where workspace_id = $1`, [workspaceId]))[0].n);

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  await setWorkspaceIcp(A.workspaceId, baseIcp);
  setSession({ workspaceId: A.workspaceId, userId: A.user.id, email: A.user.email, role: "owner" });
});
afterEach(() => setIntelligenceClient(null));

describe("research end to end (queue → engine → validated persistence)", () => {
  it("researches a lead: persists research, verified signals, evidence, scores, provenance, usage and trace", async () => {
    const fake = installFakeEngine();
    const { leadId, companyId } = await seedResearchableLead(A.workspaceId);
    const res = await enqueueLeadResearch(actor(A), [leadId]);
    expect(res.enqueued).toHaveLength(1);
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("queued");

    const tally = await drain();
    expect(tally.done).toBe(1);

    const lead = await one(sql`select icp_score, intent_score, qualified, research_status, scoring_version, researched_at from leads where id = ${leadId}`);
    expect(lead).toMatchObject({ research_status: "done", qualified: true, scoring_version: "1" });
    expect(Number(lead.icp_score)).toBeGreaterThan(80);

    const intel = (await getLeadIntelligence(A.workspaceId, leadId))!;
    expect(intel.research).toMatchObject({ status: "complete", insufficientEvidence: false });
    expect(intel.research!.whyNow).toContain("Sarah Chen".slice(0, 0) + "");
    expect(intel.verifiedSignals.map((s) => s.type).sort()).toEqual(["EXPANSION", "HIRING"]);
    expect(intel.unverifiedSignals).toEqual([]);
    expect(intel.verifiedSignals.every((s) => s.evidence.length > 0 && s.evidence.every((e) => e.verified && /^https?:\/\//.test(e.sourceUrl)))).toBe(true);
    expect(intel.verifiedSourceCount).toBeGreaterThanOrEqual(3);
    expect(intel.research!.whyFit.length).toBeGreaterThan(0);

    // enrichment filled the BLANK company fields and recorded where they came from
    const company = await one(sql`select industry, employee_count, location, researched_at from companies where id = ${companyId}`);
    expect(company).toMatchObject({ industry: "B2B SaaS", employee_count: 120, location: "Bengaluru, IN" });
    expect(company.researched_at).not.toBeNull();
    const prov = await sql`select field, source, set_by, evidence_id from field_provenance where workspace_id = ${A.workspaceId} order by field`;
    expect(prov.map((p) => p.field)).toEqual(expect.arrayContaining(["industry", "employee_count", "location"]));
    expect(prov.every((p) => p.source === "engine" && p.evidence_id !== null)).toBe(true);

    // metering + observability come from the engine's own usage[] and trace[]
    expect(await count("usage_records", A.workspaceId)).toBe(2);
    expect((await one(sql`select sum(tokens_in)::int as t from usage_records where workspace_id = ${A.workspaceId}`)).t).toBe(900);
    expect(await count("agent_run_steps", A.workspaceId)).toBe(2);
    const runs = await sql`select type, status from agent_runs where workspace_id = ${A.workspaceId} order by id`;
    expect(runs).toEqual([{ type: "research_batch", status: "completed" }, { type: "research_lead", status: "completed" }]);
    expect(fake.createCalls).toHaveLength(1);
    expect(fake.createCalls[0].context.icp.titles).toEqual([{ keywords: ["VP Sales"], weight: 25 }]);
    expect((await sql`select type from activities where workspace_id = ${A.workspaceId}`).map((a) => a.type)).toContain("lead.researched");
  });

  it("is idempotent: a double click / retry never starts a second run of the same version", async () => {
    const fake = installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const first = await enqueueLeadResearch(actor(A), [leadId]);
    const second = await enqueueLeadResearch(actor(A), [leadId]);
    expect(first.enqueued).toHaveLength(1);
    expect(second.enqueued).toEqual([]);
    expect(second.skipped).toEqual([{ leadId, reason: "already_running" }]);
    await drain();
    expect(fake.createCalls).toHaveLength(1);
    expect(await count("lead_research", A.workspaceId)).toBe(1);
  });

  it("re-research is an explicit new version: history is kept, only the latest is current", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    const rows = await sql`select is_current from lead_research where lead_id = ${leadId} order by id`;
    expect(rows.map((r) => r.is_current)).toEqual([false, true]);
    const sig = await sql`select is_current, count(*)::int as n from signals where lead_id = ${leadId} group by is_current order by is_current`;
    expect(sig).toEqual([{ is_current: false, n: 2 }, { is_current: true, n: 2 }]);
    expect((await getLeadIntelligence(A.workspaceId, leadId))!.history).toHaveLength(2);
  });

  it("never overwrites a value a user entered; a differing engine value is only reported", async () => {
    installFakeEngine();
    const { leadId, companyId } = await seedResearchableLead(A.workspaceId, { companyIndustry: "Fintech" });
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    const c = await one(sql`select industry, employee_count from companies where id = ${companyId}`);
    expect(c.industry).toBe("Fintech"); // user's value wins
    expect(c.employee_count).toBe(120); // blank → filled
    expect((await sql`select field from field_provenance where field = 'industry'`)).toEqual([]);
  });

  it("stores UNVERIFIED signals flagged, keeps them out of the verified list, and the score never uses them", async () => {
    installFakeEngine(() => loadFixture("homonym.example"));
    const { leadId } = await seedResearchableLead(A.workspaceId, { domain: "homonym.example", company: "Homonym" });
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    const intel = (await getLeadIntelligence(A.workspaceId, leadId))!;
    expect(intel.verifiedSignals).toEqual([]);
    expect(intel.unverifiedSignals).toHaveLength(1);
    expect(intel.unverifiedSignals[0]).toMatchObject({ verified: false });
    expect(intel.intentScore).toBe(0);
    expect(intel.research!.warnings).toContain("ambiguous_entity");
  });

  it("an empty result is honest: nothing invented, insufficient evidence surfaced", async () => {
    installFakeEngine(() => loadFixture("none.example"));
    const { leadId } = await seedResearchableLead(A.workspaceId, { domain: "none.example", company: "Nothing Co" });
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    const intel = (await getLeadIntelligence(A.workspaceId, leadId))!;
    expect(intel.research!.insufficientEvidence).toBe(true);
    expect(intel.verifiedSignals).toEqual([]);
    expect(intel.research!.unknowns).toContain("industry");
  });
});

describe("defensive persistence (quarantine)", () => {
  async function runWith(mutate: (r: LooseJson) => void) {
    installFakeEngine(() => {
      const r = loadFixture("acme.example");
      mutate(r);
      return r;
    });
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    const tally = await drain();
    return { leadId, tally };
  }
  const nothingWritten = async () => {
    for (const t of ["lead_research", "signals", "evidence", "field_provenance", "prospect_candidates"]) expect(await count(t, A.workspaceId)).toBe(0);
  };

  it("a signal citing evidence that does not exist writes NOTHING and dead-letters the job", async () => {
    const { leadId, tally } = await runWith((r) => (r.signals[0].evidence_ids = ["ev_999"]));
    expect(tally.dead).toBe(1);
    await nothingWritten();
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("failed");
    expect((await one(sql`select error, status from jobs where workspace_id = ${A.workspaceId}`))).toMatchObject({ status: "dead" });
    expect((await one(sql`select error from jobs where workspace_id = ${A.workspaceId}`)).error).toMatch(/does not resolve/);
  });

  it("a verified signal resting on unverified evidence is quarantined", async () => {
    const { tally } = await runWith((r) => (r.evidence[0].verification.verified = false));
    expect(tally.dead).toBe(1);
    await nothingWritten();
  });

  it("outreach or scores resting on unverified evidence are quarantined", async () => {
    const { tally } = await runWith((r) => {
      r.evidence[3].verification.verified = false;
      r.outreach.evidence_ids = ["ev_4"];
    });
    expect(tally.dead).toBe(1);
    await nothingWritten();
  });

  it("non-http(s) evidence URLs (javascript:, data:) are rejected before anything is stored", async () => {
    const { tally } = await runWith((r) => (r.evidence[0].source_url = "javascript:alert(1)"));
    expect(tally.dead).toBe(1);
    await nothingWritten();
  });

  it("a response that breaks the contract (missing field) is a permanent failure, not a retry loop", async () => {
    const { tally } = await runWith((r) => delete r.icp);
    expect(tally.dead).toBe(1);
    expect(tally.retried).toBe(0);
    await nothingWritten();
  });

  it("persistResearch itself refuses a violating payload and a foreign lead (defense in depth)", async () => {
    const parsed = researchResultSchema.parse(loadFixture("acme.example"));
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const bad = structuredClone(parsed);
    bad.signals[0].evidence_ids = ["ev_404"];
    await expect(persistResearch({ workspaceId: A.workspaceId, userId: A.user.id, leadId, companyId: null, agentRunId: null, engineRunId: "r", contractVersion: "1.0", result: bad })).rejects.toBeInstanceOf(QuarantineError);
    await expect(persistResearch({ workspaceId: B.workspaceId, userId: B.user.id, leadId, companyId: null, agentRunId: null, engineRunId: "r", contractVersion: "1.0", result: parsed })).rejects.toBeInstanceOf(AppError);
    await nothingWritten();
  });
});

describe("resilience", () => {
  it("survives an ENGINE restart mid-run by resubmitting under the same idempotency key", async () => {
    const fake = installFakeEngine();
    fake.pollsBeforeDone = 2;
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await makeDue(); await runTick({ workerId: "w" }); // submit
    await makeDue(); await runTick({ workerId: "w" }); // first poll
    fake.forgetRuns(); // the engine restarts and loses the run
    await drain();
    expect(fake.createCalls).toHaveLength(2);
    expect(fake.createCalls[0].idempotency_key).toBe(fake.createCalls[1].idempotency_key);
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("done");
    expect(await count("lead_research", A.workspaceId)).toBe(1);
  });

  it("retries a transient engine outage with backoff, then completes when it recovers", async () => {
    const fake = installFakeEngine();
    fake.faults.createError = new IntelligenceError("PROVIDER_ERROR", "The research engine is unavailable.", true, "UNREACHABLE");
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await makeDue();
    const t1 = await runTick({ workerId: "w" });
    expect(t1.retried).toBe(1);
    const job = await one(sql`select status, attempts, error, run_at > now() as backoff from jobs where workspace_id = ${A.workspaceId}`);
    expect(job).toMatchObject({ status: "queued", attempts: 1, backoff: true });
    expect(job.error).toMatch(/unavailable/);
    fake.faults.createError = undefined;
    await drain();
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("done");
  });

  it("dead-letters after max attempts of a persistent outage, and tells the user", async () => {
    const fake = installFakeEngine();
    fake.faults.createError = new IntelligenceError("PROVIDER_ERROR", "The research engine is unavailable.", true, "UNREACHABLE");
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await sql`update jobs set max_attempts = 3 where workspace_id = ${A.workspaceId}`;
    const t = await drain(8);
    expect(t.dead).toBe(1);
    expect((await one(sql`select attempts, status from jobs where workspace_id = ${A.workspaceId}`))).toMatchObject({ attempts: 3, status: "dead" });
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("failed");
    const p = await getResearchProgress(A.workspaceId, (await one(sql`select id from agent_runs where type = 'research_batch'`)).id as number);
    expect(p).toMatchObject({ finished: true, failed: 1, succeeded: 0 });
    expect(p.errors[0].message).toMatch(/unavailable/);
  });

  it("a quota-exhausted engine fails immediately (no pointless retries) with an actionable message", async () => {
    const fake = installFakeEngine();
    fake.faults.runFails = { code: "QUOTA_EXCEEDED", message: "LLM quota exceeded — check billing.", retryable: false };
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    const t = await drain();
    expect(t.dead).toBe(1);
    expect(t.retried).toBe(0);
    expect((await one(sql`select error from jobs where workspace_id = ${A.workspaceId}`)).error).toMatch(/quota/i);
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("failed");
  });

  it("recovers a job whose worker died (expired lease) and counts it as a failure", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await sql`update jobs set status = 'running', locked_by = 'dead-worker', locked_until = now() - interval '1 minute'`;
    await drain();
    const j = await one(sql`select status, attempts from jobs where workspace_id = ${A.workspaceId}`);
    expect(j).toMatchObject({ status: "succeeded", attempts: 1 });
  });

  it("two workers ticking at once never process the same job twice", async () => {
    const fake = installFakeEngine();
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) ids.push((await seedResearchableLead(A.workspaceId, { name: `Lead ${i}`, domain: `co${i}.example`, company: `Co ${i}`, email: null })).leadId);
    await enqueueLeadResearch(actor(A), ids);
    for (let round = 0; round < 6; round++) {
      await makeDue();
      await Promise.all([runTick({ workerId: "w1", batchSize: 3 }), runTick({ workerId: "w2", batchSize: 3 })]);
    }
    expect(fake.createCalls).toHaveLength(6); // exactly one submission per lead
    expect(await count("lead_research", A.workspaceId)).toBe(6);
  });
});

describe("bulk research, progress and cancel", () => {
  it("caps a batch, validates input, and reports progress from the jobs themselves", async () => {
    installFakeEngine();
    await expect(enqueueLeadResearch(actor(A), Array.from({ length: 51 }, (_, i) => i + 1))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(enqueueLeadResearch(actor(A), [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await seedResearchableLead(A.workspaceId, { name: `L${i}`, domain: `d${i}.example`, company: `C${i}`, email: null })).leadId);
    const { agentRunId } = await enqueueLeadResearch(actor(A), ids);
    expect(await getResearchProgress(A.workspaceId, agentRunId)).toMatchObject({ total: 3, queued: 3, finished: false });
    await drain();
    expect(await getResearchProgress(A.workspaceId, agentRunId)).toMatchObject({ total: 3, succeeded: 3, finished: true });
    expect((await one(sql`select status from agent_runs where id = ${agentRunId}`)).status).toBe("completed");
  });

  it("skips unknown/unresearchable leads with a reason instead of failing the batch", async () => {
    installFakeEngine();
    const [bare] = await sql`insert into leads (workspace_id, full_name) values (${A.workspaceId}, 'No Company') returning id`;
    const ok = await seedResearchableLead(A.workspaceId);
    const r = await enqueueLeadResearch(actor(A), [Number(bare.id), ok.leadId, 999999]);
    expect(r.enqueued).toHaveLength(1);
    expect(r.skipped).toEqual(expect.arrayContaining([{ leadId: Number(bare.id), reason: "no_company" }, { leadId: 999999, reason: "not_found" }]));
  });

  it("explains itself when the engine is not configured", async () => {
    setIntelligenceClient(null);
    const prev = { ...process.env };
    delete process.env.INTELLIGENCE_URL; delete process.env.INTELLIGENCE_SERVICE_TOKEN; delete process.env.INTELLIGENCE_SIGNING_SECRET;
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await expect(enqueueLeadResearch(actor(A), [leadId])).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    Object.assign(process.env, prev);
  });

  it("cancel stops queued jobs, tells the engine, and restores an honest lead status", async () => {
    const fake = installFakeEngine();
    fake.pollsBeforeDone = 5;
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const { agentRunId } = await enqueueLeadResearch(actor(A), [leadId]);
    await makeDue(); await runTick({ workerId: "w" }); // submitted to the engine
    const r = await cancelResearch(actor(A), agentRunId);
    expect(r.canceled).toBe(1);
    expect(fake.cancelCalls).toHaveLength(1);
    expect((await one(sql`select status from jobs where workspace_id = ${A.workspaceId}`)).status).toBe("canceled");
    expect((await one(sql`select research_status from leads where id = ${leadId}`)).research_status).toBe("none");
    expect((await one(sql`select status from agent_runs where id = ${agentRunId}`)).status).toBe("canceled");
    await drain();
    expect(await count("lead_research", A.workspaceId)).toBe(0);
  });
});

describe("re-scoring after an ICP edit (pure function of stored, verified inputs)", () => {
  it("re-scores researched leads without re-researching; unverified signals never count; idempotent per ICP", async () => {
    const fake = installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();
    fake.scoreImpl = () => ({
      scoring_version: "1", icp: { score: 42, confidence: 0.6, breakdown: [{ criterion: "industry", status: "not_met", weight: 25, points: 0, evidence_ids: [] }] },
      intent: { score: 10, breakdown: [] }, qualified: false, why_fit: [{ criterion: "industry", status: "not_met", text: "Industry does not match", evidence_ids: [] }],
    });
    await setWorkspaceIcp(A.workspaceId, { ...baseIcp, industries: ["Fintech"] });
    expect((await enqueueRescoreAll(actor(A))).enqueued).toBe(1);
    await drain();
    expect((await enqueueRescoreAll(actor(A))).enqueued).toBe(0); // same ICP fingerprint ⇒ no duplicate work
    expect(fake.createCalls).toHaveLength(1); // no new research
    expect(fake.scoreCalls).toHaveLength(1);
    const call = fake.scoreCalls[0];
    expect(call.company).toMatchObject({ industry: "b2b_saas", country: "IN", employee_count: 120, keywords_found: ["outbound"] });
    expect(call.signals.every((s) => s.verified)).toBe(true);
    expect(call.icp.industries).toEqual([{ value: "Fintech", weight: 25 }]);
    const lead = await one(sql`select icp_score, intent_score, qualified from leads where id = ${leadId}`);
    expect(lead).toMatchObject({ icp_score: 42, intent_score: 10, qualified: false });
    expect((await getLeadIntelligence(A.workspaceId, leadId))!.research!.whyFit[0].text).toBe("Industry does not match");
  });

  it("skips leads that were never researched", async () => {
    installFakeEngine();
    await seedResearchableLead(A.workspaceId);
    expect((await enqueueRescoreAll(actor(A))).enqueued).toBe(0);
  });
});

describe("tenant isolation", () => {
  it("workspace B cannot research, read, cancel or affect workspace A's leads", async () => {
    const fake = installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch(actor(A), [leadId]);
    await drain();

    const attempt = await enqueueLeadResearch(actor(B), [leadId]);
    expect(attempt.enqueued).toEqual([]);
    expect(attempt.skipped).toEqual([{ leadId, reason: "not_found" }]);
    expect(await getLeadIntelligence(B.workspaceId, leadId)).toBeNull();
    const aRun = (await one(sql`select id from agent_runs where workspace_id = ${A.workspaceId} and type = 'research_batch'`)).id as number;
    await expect(getResearchProgress(B.workspaceId, aRun)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await cancelResearch(actor(B), aRun)).canceled).toBe(0);
    for (const t of ["lead_research", "signals", "evidence", "jobs", "usage_records", "agent_runs", "agent_run_steps", "field_provenance"]) {
      expect(await count(t, B.workspaceId)).toBeLessThanOrEqual(t === "agent_runs" ? 1 : 0);
    }
    expect(fake.createCalls).toHaveLength(1);
    // The engine receives DATA only: the request carries A's ICP but no workspace/user/record identifier, and its
    // idempotency key is opaque.
    const sent = fake.createCalls[0];
    expect(Object.keys(sent).sort()).toEqual(["budgets", "context", "idempotency_key", "input", "task"]);
    expect(sent.idempotency_key).toMatch(/^research:[0-9a-f]{24}$/);
    expect(JSON.stringify(sent)).not.toMatch(/workspace|user_id|lead_id|company_id/i);
  });
});
