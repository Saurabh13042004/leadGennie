import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "./test-db";
import { runTick, type TickResult } from "@/lib/jobs/worker";
import "@/lib/jobs/handlers"; // registers the research/scoring handlers
import { FakeIntelligenceClient } from "@/lib/intelligence/fake";
import { setIntelligenceClient } from "@/lib/intelligence/client";

/** The engine's own golden output (services/intelligence/scripts/export_fixtures.py). */
/** Untyped JSON we deliberately mutate to build invalid engine payloads — typing it would defeat the point. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseJson = Record<string, any>;

export function loadFixture(name: "acme.example" | "thin.example" | "homonym.example" | "none.example"): LooseJson {
  return JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/intelligence", `${name}.json`), "utf-8"));
}

export function installFakeEngine(fixtureFor: (domain: string | null | undefined) => unknown = () => loadFixture("acme.example")) {
  const fake = new FakeIntelligenceClient();
  fake.resultFor = (req) => structuredClone(fixtureFor(req.input.company.domain));
  setIntelligenceClient(fake);
  return fake;
}

/** Jobs wait (poll intervals, backoff) in real time; tests make them due immediately. */
export async function makeDue() {
  await sql`update jobs set run_at = now() where status = 'queued'`;
}

/** Runs worker ticks until nothing is queued/running (or `maxTicks`). Returns the summed tallies. */
export async function drain(maxTicks = 12): Promise<TickResult> {
  const total: TickResult = { claimed: 0, done: 0, waiting: 0, retried: 0, dead: 0, lost: 0 };
  for (let i = 0; i < maxTicks; i++) {
    await makeDue();
    const t = await runTick({ budgetMs: 10_000, maxJobs: 50, workerId: "test-worker" });
    for (const k of Object.keys(total) as (keyof TickResult)[]) total[k] += t[k];
    const open = await sql`select count(*)::int as n from jobs where status in ('queued', 'running')`;
    if (Number(open[0].n) === 0) break;
  }
  return total;
}

export async function seedResearchableLead(workspaceId: number, opts: { name?: string; company?: string; domain?: string | null; email?: string | null; jobTitle?: string | null; companyIndustry?: string | null } = {}) {
  const domain = opts.domain === undefined ? "acme.example" : opts.domain;
  const [c] = await sql`
    insert into companies (workspace_id, name, name_key, domain, industry)
    values (${workspaceId}, ${opts.company ?? "Acme"}, ${(opts.company ?? "Acme").toLowerCase()}, ${domain}, ${opts.companyIndustry ?? null})
    on conflict do nothing returning id`;
  const companyId = c ? Number(c.id) : Number((await sql`select id from companies where workspace_id = ${workspaceId} and lower(domain) = ${domain}`)[0].id);
  const [l] = await sql`
    insert into leads (workspace_id, full_name, email, company, company_id, job_title)
    values (${workspaceId}, ${opts.name ?? "Sarah Chen"}, ${opts.email === undefined ? `sarah${Math.random().toString(36).slice(2, 8)}@acme.example` : opts.email},
            ${opts.company ?? "Acme"}, ${companyId}, ${opts.jobTitle ?? null}) returning id`;
  return { leadId: Number(l.id), companyId };
}

export async function setWorkspaceIcp(workspaceId: number, icp: Record<string, unknown>, positioning = "We help outbound teams book meetings.") {
  await sql`update workspaces set icp = ${JSON.stringify(icp)}, positioning = ${positioning} where id = ${workspaceId}`;
}

export const baseIcp = {
  version: 1, industries: ["B2B SaaS"], employee_range: { min: 50, max: 500 }, geographies: ["India"], titles: ["VP Sales"],
  exclusions: { industries: [], domains: [], titles: [] },
  scoring: { min_score_to_qualify: 70, weights: { industry: 25, employee_range: 20, geography: 15, title: 25 }, keywords: [{ keyword: "outbound", weight: 15 }] },
};
