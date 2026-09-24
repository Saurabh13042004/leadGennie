import { sql } from "@/lib/db/client";
import { buildWhere, FROM } from "@/lib/db/leads-list";
import { parseLeadListParams } from "@/lib/domain/leads/list-query";
import type { StepRecord } from "@/lib/agent/orchestrator";
import type { LeadFilter, RankedLead } from "@/lib/agent/tools/types";
import { planSchema, runStateSchema, type Plan, type RunState } from "@/lib/agent/types";

/**
 * Repository for Gennie: lead selection (reusing the Leads page's own WHERE builder so a filter can never mean
 * two things), and the agent_runs rows that hold plans and run state. Every statement filters by workspace_id.
 */

// ---- lead selection ------------------------------------------------------------------------------------------

const toQuery = (f: LeadFilter) =>
  parseLeadListParams({ q: f.search, stage: f.stage, research: f.research, min_score: f.minScore === undefined ? undefined : String(f.minScore) });

export async function countLeadsMatching(workspaceId: number, filter: LeadFilter): Promise<number> {
  const { where, params } = buildWhere(workspaceId, toQuery(filter));
  const rows = await sql.query(`select count(*)::int as n ${FROM} where ${where}`, params);
  return Number(rows[0].n);
}

/** Best-scored first, then newest — a stable order so "top N" means the same thing twice. */
export async function findLeadIdsMatching(workspaceId: number, filter: LeadFilter, limit: number): Promise<{ leadIds: number[]; total: number }> {
  const { where, params } = buildWhere(workspaceId, toQuery(filter));
  const total = await countLeadsMatching(workspaceId, filter);
  const rows = await sql.query(
    `select l.id ${FROM} where ${where} order by l.icp_score desc nulls last, l.created_at desc, l.id desc limit ${Math.max(1, Math.trunc(limit))}`,
    params,
  );
  return { leadIds: rows.map((r) => Number(r.id)), total };
}

export type LeadSnapshot = { total: number; unresearched: number; researched: number };

export async function leadSnapshot(workspaceId: number): Promise<LeadSnapshot> {
  const rows = await sql`
    select count(*)::int as total,
           count(*) filter (where research_status = 'none')::int as unresearched,
           count(*) filter (where research_status in ('done', 'partial'))::int as researched
    from leads where workspace_id = ${workspaceId}
  `;
  return { total: Number(rows[0].total), unresearched: Number(rows[0].unresearched), researched: Number(rows[0].researched) };
}

export async function icpConfigured(workspaceId: number): Promise<boolean> {
  const rows = await sql`select icp is not null as configured from workspaces where id = ${workspaceId}`;
  return rows.length > 0 && rows[0].configured === true;
}

export async function rankLeads(workspaceId: number, leadIds: number[], top: number): Promise<RankedLead[]> {
  if (leadIds.length === 0) return [];
  const rows = await sql`
    select l.id, l.full_name, coalesce(c.name, l.company) as company, l.job_title,
           l.icp_score, l.intent_score, l.qualified, l.research_status,
           coalesce((select json_agg(t.type order by t.type) from (
             select distinct s.type from signals s
             where s.lead_id = l.id and s.workspace_id = l.workspace_id and s.is_current and s.verified) t), '[]'::json) as signal_types
    from leads l left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
    where l.workspace_id = ${workspaceId} and l.id = any(${leadIds}::bigint[])
    order by l.icp_score desc nulls last, l.intent_score desc nulls last, l.id
    limit ${Math.max(1, Math.trunc(top))}
  `;
  return rows.map((r) => ({
    leadId: Number(r.id), name: String(r.full_name), company: (r.company as string | null) ?? null, title: (r.job_title as string | null) ?? null,
    icpScore: r.icp_score === null ? null : Number(r.icp_score), intentScore: r.intent_score === null ? null : Number(r.intent_score),
    qualified: (r.qualified as boolean | null) ?? null, researchStatus: String(r.research_status), signalTypes: (r.signal_types as string[]) ?? [],
  }));
}

export type LeadOutcomeCounts = { considered: number; researched: number; qualified: number; researchFailed: number; avgIcpScore: number | null };

/** Run results are counted from the leads table — never narrated by the model. */
export async function leadOutcomeCounts(workspaceId: number, leadIds: number[]): Promise<LeadOutcomeCounts> {
  if (leadIds.length === 0) return { considered: 0, researched: 0, qualified: 0, researchFailed: 0, avgIcpScore: null };
  const rows = await sql`
    select count(*)::int as considered,
           count(*) filter (where research_status in ('done', 'partial'))::int as researched,
           count(*) filter (where qualified is true)::int as qualified,
           count(*) filter (where research_status = 'failed')::int as failed,
           round(avg(icp_score))::int as avg_score
    from leads where workspace_id = ${workspaceId} and id = any(${leadIds}::bigint[])
  `;
  const r = rows[0];
  return {
    considered: Number(r.considered), researched: Number(r.researched), qualified: Number(r.qualified),
    researchFailed: Number(r.failed), avgIcpScore: r.avg_score === null ? null : Number(r.avg_score),
  };
}

export async function leadNames(workspaceId: number, leadIds: number[]): Promise<Map<number, string>> {
  if (leadIds.length === 0) return new Map();
  const rows = await sql`select id, full_name from leads where workspace_id = ${workspaceId} and id = any(${leadIds}::bigint[])`;
  return new Map(rows.map((r) => [Number(r.id), String(r.full_name)]));
}

// ---- runs ---------------------------------------------------------------------------------------------------

export type GennieRunStatus = "planned" | "awaiting_approval" | "running" | "paused" | "completed" | "failed" | "canceled";

export type GennieRunRow = {
  id: number;
  userId: number | null;
  status: GennieRunStatus;
  prompt: string;
  plan: Plan | null;
  state: RunState | null;
  output: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function toRun(r: Record<string, unknown>): GennieRunRow {
  const plan = planSchema.safeParse(r.plan);
  const state = runStateSchema.safeParse(r.progress);
  return {
    id: Number(r.id),
    userId: r.user_id === null ? null : Number(r.user_id),
    status: r.status as GennieRunStatus,
    prompt: String((r.input as { prompt?: string } | null)?.prompt ?? ""),
    plan: plan.success ? plan.data : null,
    state: state.success ? state.data : null,
    output: (r.output ?? {}) as Record<string, unknown>,
    error: (r.error as string | null) ?? null,
    createdAt: iso(r.created_at) as string,
    completedAt: iso(r.completed_at),
  };
}

export async function createGennieRun(input: {
  workspaceId: number;
  userId: number;
  prompt: string;
  status: GennieRunStatus;
  plan: Plan | null;
  error?: string | null;
}): Promise<number> {
  const rows = await sql`
    insert into agent_runs (workspace_id, user_id, type, input, plan, status, error, completed_at)
    values (${input.workspaceId}, ${input.userId}, 'gennie', ${JSON.stringify({ prompt: input.prompt })},
            ${input.plan ? JSON.stringify(input.plan) : null}, ${input.status}, ${input.error ?? null},
            ${input.status === "failed" ? new Date().toISOString() : null})
    returning id
  `;
  return Number(rows[0].id);
}

export async function getGennieRun(workspaceId: number, runId: number): Promise<GennieRunRow | null> {
  const rows = await sql`select * from agent_runs where id = ${runId} and workspace_id = ${workspaceId} and type = 'gennie'`;
  return rows.length === 0 ? null : toRun(rows[0]);
}

export async function listGennieRuns(workspaceId: number, limit = 8): Promise<GennieRunRow[]> {
  const rows = await sql`
    select * from agent_runs where workspace_id = ${workspaceId} and type = 'gennie' order by created_at desc, id desc limit ${limit}
  `;
  return rows.map(toRun);
}

export async function getGennieRunStatus(workspaceId: number, runId: number): Promise<GennieRunStatus | null> {
  const rows = await sql`select status from agent_runs where id = ${runId} and workspace_id = ${workspaceId} and type = 'gennie'`;
  return rows.length === 0 ? null : (rows[0].status as GennieRunStatus);
}

/** Guarded transition: only moves the run if it is currently in one of `from` (so two racing clicks can't both win). */
export async function transitionGennieRun(
  workspaceId: number,
  runId: number,
  from: GennieRunStatus[],
  to: GennieRunStatus,
  patch: { error?: string | null; output?: Record<string, unknown>; progress?: RunState } = {},
): Promise<boolean> {
  const terminal = to === "completed" || to === "failed" || to === "canceled";
  const rows = await sql`
    update agent_runs
    set status = ${to},
        completed_at = case when ${terminal} then now() else completed_at end,
        error = coalesce(${patch.error ?? null}, error),
        output = coalesce(${patch.output ? JSON.stringify(patch.output) : null}::jsonb, output),
        progress = coalesce(${patch.progress ? JSON.stringify(patch.progress) : null}::jsonb, progress)
    where id = ${runId} and workspace_id = ${workspaceId} and type = 'gennie' and status = any(${from}::text[])
    returning id
  `;
  return rows.length > 0;
}

/**
 * Only while running: a canceled or paused run's stored progress must not be overwritten by a tick that was
 * already in flight (the in-flight step's outcome is recovered from the tools' own idempotency on resume).
 */
export async function saveRunProgress(workspaceId: number, runId: number, state: RunState): Promise<void> {
  await sql`
    update agent_runs set progress = ${JSON.stringify(state)}
    where id = ${runId} and workspace_id = ${workspaceId} and type = 'gennie' and status = 'running'
  `;
}

export async function saveRunTokens(workspaceId: number, runId: number, tokens: number): Promise<void> {
  await sql`update agent_runs set tokens_used = ${tokens} where id = ${runId} and workspace_id = ${workspaceId} and type = 'gennie'`;
}

export async function appendRunStep(workspaceId: number, runId: number, rec: StepRecord): Promise<void> {
  await sql`
    insert into agent_run_steps (run_id, workspace_id, seq, agent, tool, input_summary, output_summary, status, duration_ms)
    values (${runId}, ${workspaceId}, ${rec.seq}, 'gennie', ${rec.tool}, ${rec.inputSummary}, ${rec.outputSummary}, ${rec.status}, ${rec.durationMs})
  `;
}

export async function findResearchBatchOf(workspaceId: number, parentRunId: number): Promise<number | null> {
  const rows = await sql`
    select id from agent_runs
    where workspace_id = ${workspaceId} and parent_run_id = ${parentRunId} and type = 'research_batch'
    order by id limit 1
  `;
  return rows.length === 0 ? null : Number(rows[0].id);
}
