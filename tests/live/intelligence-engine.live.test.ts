import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { baseIcp, drain, seedResearchableLead, setWorkspaceIcp } from "../helpers/intelligence";
import { HttpIntelligenceClient, setIntelligenceClient } from "@/lib/intelligence/client";
import { enqueueLeadResearch } from "@/lib/intelligence/service";
import { getLeadIntelligence } from "@/lib/intelligence/read-model";

/**
 * Cross-language check against a REAL engine process (nothing faked between the two runtimes): signed HTTP,
 * the engine's real contract output parsed by zod, invariants, persistence, scoring. Opt-in:
 *
 *   (cd services/intelligence && ENGINE_FAKE_MODE=1 INTELLIGENCE_SERVICE_TOKEN=dev-token INTELLIGENCE_SIGNING_SECRET=dev-secret \
 *      uv run uvicorn app.main:app_factory --factory --port 18100) &
 *   RUN_LIVE_ENGINE=1 INTELLIGENCE_URL=http://localhost:18100 npx vitest run tests/live/intelligence-engine.live.test.ts
 */
const URL_ = process.env.INTELLIGENCE_URL;

describe.skipIf(!process.env.RUN_LIVE_ENGINE || !URL_)("real Python engine ⇄ Next.js", () => {
  let W: { workspaceId: number; user: { id: number; email: string } };
  const cfg = { baseUrl: URL_ ?? "", token: process.env.INTELLIGENCE_SERVICE_TOKEN ?? "dev-token", secret: process.env.INTELLIGENCE_SIGNING_SECRET ?? "dev-secret" };

  beforeEach(async () => {
    await resetDb();
    // The engine outlives the test database: ids restart after resetDb, so make them unique per test or the
    // (deterministic, id-derived) idempotency keys would replay an earlier test's run.
    for (const seq of ["workspaces_id_seq", "leads_id_seq", "companies_id_seq", "users_id_seq"]) {
      await sql.query(`select setval('${seq}', $1)`, [Math.floor(Math.random() * 1e9) + 1]);
    }
    W = await createWorkspace();
    await setWorkspaceIcp(W.workspaceId, baseIcp);
    setSession({ workspaceId: W.workspaceId, userId: W.user.id, email: W.user.email, role: "owner" });
    setIntelligenceClient(new HttpIntelligenceClient(cfg));
  });

  it("authenticates with a signed request and reports capabilities", async () => {
    const caps = await new HttpIntelligenceClient(cfg).capabilities();
    expect(caps).toMatchObject({ contract_version: "1.0", tasks: expect.arrayContaining(["lead_research"]) });
  });

  it("a wrong secret is rejected by the engine (auth is really enforced)", async () => {
    await expect(new HttpIntelligenceClient({ ...cfg, secret: "wrong" }).capabilities()).rejects.toMatchObject({ engineCode: "UNAUTHENTICATED", retryable: false });
  });

  it("researches a lead end to end: HTTP → engine → zod → invariants → database → read model", async () => {
    const { leadId } = await seedResearchableLead(W.workspaceId, { jobTitle: "VP Sales" });
    await enqueueLeadResearch({ workspaceId: W.workspaceId, userId: W.user.id }, [leadId]);
    const tally = await drain(40);
    expect(tally.done).toBe(1);
    const intel = (await getLeadIntelligence(W.workspaceId, leadId))!;
    expect(intel.researchStatus).toBe("done");
    expect(intel.verifiedSignals.map((s) => s.type).sort()).toEqual(["EXPANSION", "HIRING"]);
    expect(intel.icpScore).toBeGreaterThan(80);
    expect(intel.research!.whyNow).toMatch(/SDR|US expansion/);
    const usage = await sql`select kind from usage_records where workspace_id = ${W.workspaceId}`;
    expect(usage.length).toBeGreaterThan(0);
  });

  it("the engine's own quota failure surfaces as a permanent, actionable failure", async () => {
    const { leadId } = await seedResearchableLead(W.workspaceId, { domain: "quota.example", company: "Quota Co", email: null });
    await enqueueLeadResearch({ workspaceId: W.workspaceId, userId: W.user.id }, [leadId]);
    const tally = await drain(40);
    expect(tally.dead).toBe(1);
    expect((await sql`select error from jobs where workspace_id = ${W.workspaceId}`)[0].error).toMatch(/quota/i);
  });
});
