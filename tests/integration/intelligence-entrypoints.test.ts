import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { baseIcp, drain, installFakeEngine, seedResearchableLead, setWorkspaceIcp } from "../helpers/intelligence";
import { setIntelligenceClient } from "@/lib/intelligence/client";
import { enqueueLeadResearch } from "@/lib/intelligence/service";
import { POST as tick } from "@/app/api/jobs/tick/route";
import { POST as researchOne } from "@/app/api/leads/[id]/research/route";
import { POST as researchMany } from "@/app/api/leads/research/route";
import { POST as scoreOne } from "@/app/api/leads/[id]/score/route";
import { GET as intelligence } from "@/app/api/leads/[id]/intelligence/route";
import { GET as progress } from "@/app/api/research/[runId]/route";
import { researchLeads, testIcpAgainstSample, cancelResearchAction } from "@/lib/actions/intelligence";
import { saveWorkspaceProfile } from "@/lib/actions/workspace-profile";
import { getLeadsPage } from "@/lib/actions/leads";
import { parseLeadListParams } from "@/lib/domain/leads/list-query";

type W = { workspaceId: number; user: { id: number; email: string } };
let A: W;
let B: W;
const as = (w: W, role: "owner" | "admin" | "member" | "viewer" = "owner") => setSession({ workspaceId: w.workspaceId, userId: w.user.id, email: w.user.email, role });
const post = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://app.test${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  await setWorkspaceIcp(A.workspaceId, baseIcp);
  as(A);
  process.env.CRON_SECRET = "cron-secret";
});
afterEach(() => setIntelligenceClient(null));

describe("POST /api/jobs/tick", () => {
  it("rejects a missing or wrong secret with a structured 401, and a missing config with 503", async () => {
    const noAuth = await tick(post("/api/jobs/tick"), undefined);
    expect(noAuth.status).toBe(401);
    expect(await noAuth.json()).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect((await tick(post("/api/jobs/tick", undefined, { authorization: "Bearer nope" }), undefined)).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await tick(post("/api/jobs/tick", undefined, { authorization: "Bearer x" }), undefined)).status).toBe(503);
  });

  it("drains due jobs across workspaces and reports what it did", async () => {
    installFakeEngine();
    const a = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch({ workspaceId: A.workspaceId, userId: A.user.id }, [a.leadId]);
    await sql`update jobs set run_at = now()`;
    const res = await tick(post("/api/jobs/tick", undefined, { authorization: "Bearer cron-secret" }), undefined);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, claimed: 1, waiting: 1 });
  });
});

describe("research routes", () => {
  it("POST /api/leads/:id/research returns 202 with the run, and is tenant-scoped", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const res = await researchOne(post(`/api/leads/${leadId}/research`), ctx({ id: String(leadId) }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, enqueued: [{ leadId }], skipped: [] });
    expect(typeof body.agent_run_id).toBe("number");

    as(B); // another workspace can't research it
    const foreign = await (await researchOne(post(`/api/leads/${leadId}/research`), ctx({ id: String(leadId) }))).json();
    expect(foreign.enqueued).toEqual([]);
    expect(foreign.skipped).toEqual([{ leadId, reason: "not_found" }]);
    expect(Number((await one(sql`select count(*)::int as n from jobs where workspace_id = ${B.workspaceId}`)).n)).toBe(0);
  });

  it("validates ids and bodies with structured errors", async () => {
    installFakeEngine();
    const bad = await researchOne(post("/api/leads/abc/research"), ctx({ id: "abc" }));
    expect(bad.status).toBe(400);
    expect((await researchMany(post("/api/leads/research", { lead_ids: [] }), undefined)).status).toBe(422);
    expect((await researchMany(post("/api/leads/research", { lead_ids: ["x"] }), undefined)).status).toBe(422);
    expect((await researchMany(new Request("http://app.test/api/leads/research", { method: "POST", body: "not json" }), undefined)).status).toBe(400);
  });

  it("viewers cannot start research; unauthenticated callers get 401", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    as(A, "viewer");
    expect((await researchOne(post(`/api/leads/${leadId}/research`), ctx({ id: String(leadId) }))).status).toBe(403);
    expect((await researchLeads([leadId])).ok).toBe(false);
    setSession(null);
    expect((await researchOne(post(`/api/leads/${leadId}/research`), ctx({ id: String(leadId) }))).status).toBe(401);
  });

  it("GET intelligence / progress are viewer-readable, 404 for foreign resources, and never leak across tenants", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    const r = await (await researchOne(post(`/api/leads/${leadId}/research`), ctx({ id: String(leadId) }))).json();
    await drain();

    as(A, "viewer");
    const intel = await (await intelligence(new Request("http://app.test"), ctx({ id: String(leadId) }))).json();
    expect(intel.intelligence.verifiedSignals.length).toBe(2);
    expect((await (await progress(new Request("http://app.test"), ctx({ runId: String(r.agent_run_id) }))).json()).progress).toMatchObject({ finished: true, succeeded: 1 });

    as(B);
    expect((await intelligence(new Request("http://app.test"), ctx({ id: String(leadId) }))).status).toBe(404);
    expect((await progress(new Request("http://app.test"), ctx({ runId: String(r.agent_run_id) }))).status).toBe(404);
    expect((await cancelResearchAction(r.agent_run_id)).ok).toBe(true);
    expect(Number((await one(sql`select count(*)::int as n from jobs where workspace_id = ${A.workspaceId} and status = 'canceled'`)).n)).toBe(0);
  });

  it("POST /api/leads/:id/score queues a re-score only when the lead has research", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    expect(await (await scoreOne(post(`/api/leads/${leadId}/score`), ctx({ id: String(leadId) }))).json()).toMatchObject({ ok: true, enqueued: true });
    // the scoring job for an unresearched lead is a harmless no-op
    await drain();
    expect(Number((await one(sql`select count(*)::int as n from lead_research`)).n)).toBe(0);
    as(B);
    expect((await scoreOne(post(`/api/leads/${leadId}/score`), ctx({ id: String(leadId) }))).status).toBe(404);
  });
});

describe("ICP editing", () => {
  it("testIcpAgainstSample scores an UNSAVED ICP through the engine and stores nothing", async () => {
    const fake = installFakeEngine();
    fake.scoreImpl = () => ({
      scoring_version: "1", icp: { score: 88, confidence: 0.9, breakdown: [{ criterion: "industry", status: "met", weight: 25, points: 25, value_found: "b2b_saas", evidence_ids: [] }] },
      intent: { score: 0, breakdown: [] }, qualified: true, why_fit: [{ criterion: "industry", status: "met", text: "Industry matches", evidence_ids: [] }],
    });
    const before = Number((await one(sql`select count(*)::int as n from activities`)).n);
    const res = await testIcpAgainstSample({ icp: { ...baseIcp, industries: ["Fintech"] }, sample: { industry: "Fintech", country: "India", employeeCount: 90, title: "CTO", keywordsFound: [] } });
    expect(res).toMatchObject({ ok: true, data: { icpScore: 88, qualified: true } });
    expect(fake.scoreCalls[0].icp.industries).toEqual([{ value: "Fintech", weight: 25 }]);
    expect(fake.scoreCalls[0].person).toEqual({ title: "CTO" });
    expect(Number((await one(sql`select count(*)::int as n from activities`)).n)).toBe(before);
  });

  it("rejects an invalid ICP or sample with a field-level message (no engine call)", async () => {
    const fake = installFakeEngine();
    const bad = await testIcpAgainstSample({ icp: { ...baseIcp, scoring: { ...baseIcp.scoring, min_score_to_qualify: 500 } }, sample: {} });
    expect(bad).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect((await testIcpAgainstSample({ icp: baseIcp, sample: { employeeCount: -5 } })).ok).toBe(false);
    expect(fake.scoreCalls).toHaveLength(0);
  });

  it("saving a CHANGED ICP re-scores researched leads in the background; an unchanged ICP does nothing", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch({ workspaceId: A.workspaceId, userId: A.user.id }, [leadId]);
    await drain();

    const same = await saveWorkspaceProfile({ positioning: "We help outbound teams.", companyName: "Us", icp: baseIcp });
    expect(same).toMatchObject({ ok: true, data: { rescoring: 0 } });

    const changed = await saveWorkspaceProfile({ positioning: "We help outbound teams.", companyName: "Us", icp: { ...baseIcp, industries: ["Fintech"] } });
    expect(changed).toMatchObject({ ok: true, data: { rescoring: 1 } });
    expect(Number((await one(sql`select count(*)::int as n from jobs where type = 'lead_scoring'`)).n)).toBe(1);
    // saving the same changed ICP again is idempotent
    expect(await saveWorkspaceProfile({ positioning: "We help outbound teams.", companyName: "Us", icp: { ...baseIcp, industries: ["Fintech"] } })).toMatchObject({ data: { rescoring: 0 } });
  });

  it("does not try to re-score (and does not fail the save) when the engine is not configured", async () => {
    setIntelligenceClient(null);
    const prev = { ...process.env };
    delete process.env.INTELLIGENCE_URL; delete process.env.INTELLIGENCE_SERVICE_TOKEN; delete process.env.INTELLIGENCE_SIGNING_SECRET;
    const res = await saveWorkspaceProfile({ positioning: "x", companyName: "y", icp: { ...baseIcp, industries: ["Fintech"] } });
    Object.assign(process.env, prev);
    expect(res).toMatchObject({ ok: true, data: { rescoring: 0 } });
  });
});

describe("lead list with scores", () => {
  it("shows score/status/signals, sorts unresearched leads LAST in both directions, and filters by score and research state", async () => {
    installFakeEngine();
    const researched = await seedResearchableLead(A.workspaceId, { name: "Researched One" });
    await seedResearchableLead(A.workspaceId, { name: "Never Researched", domain: "other.example", company: "Other", email: null });
    await enqueueLeadResearch({ workspaceId: A.workspaceId, userId: A.user.id }, [researched.leadId]);
    await drain();

    const page = (q: Record<string, string>) => getLeadsPage(q).then((r) => r.page.rows);
    const rows = await page({});
    const r1 = rows.find((r) => r.full_name === "Researched One")!;
    expect(r1).toMatchObject({ research_status: "done", qualified: true });
    expect(r1.icp_score).toBeGreaterThan(80);
    expect(r1.signal_types).toEqual(["EXPANSION", "HIRING"]);
    expect(rows.find((r) => r.full_name === "Never Researched")).toMatchObject({ icp_score: null, research_status: "none", signal_types: [] });

    expect((await page({ sort: "icp", dir: "desc" })).map((r) => r.full_name)).toEqual(["Researched One", "Never Researched"]);
    expect((await page({ sort: "icp", dir: "asc" })).map((r) => r.full_name)).toEqual(["Researched One", "Never Researched"]); // nulls last either way
    expect((await page({ min_score: "80" })).map((r) => r.full_name)).toEqual(["Researched One"]);
    expect((await page({ research: "none" })).map((r) => r.full_name)).toEqual(["Never Researched"]);
    expect((await page({ research: "researched" })).map((r) => r.full_name)).toEqual(["Researched One"]);
    expect(parseLeadListParams({ min_score: "999", research: "bogus", sort: "icp; drop table leads" })).toMatchObject({ minScore: 100, research: "", sort: "created" });
  });

  it("scores never leak between workspaces in the list", async () => {
    installFakeEngine();
    const { leadId } = await seedResearchableLead(A.workspaceId);
    await enqueueLeadResearch({ workspaceId: A.workspaceId, userId: A.user.id }, [leadId]);
    await drain();
    as(B);
    expect((await getLeadsPage({})).page.rows).toEqual([]);
  });
});
