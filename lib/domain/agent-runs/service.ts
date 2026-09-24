import { sql } from "@/lib/db/client";

export type AgentRunStatus = "planned" | "awaiting_approval" | "running" | "paused" | "completed" | "failed" | "canceled";

export type EngineTraceStep = {
  seq: number;
  stage: string;
  agent?: string | null;
  tool?: string | null;
  started_at: string;
  duration_ms: number;
  status: string;
  input_summary?: string;
  output_summary?: string;
  tokens_in?: number;
  tokens_out?: number;
  error?: string | null;
};

export async function createAgentRun(input: {
  workspaceId: number;
  userId: number | null;
  type: string;
  input?: Record<string, unknown>;
  parentRunId?: number | null;
  status?: AgentRunStatus;
}): Promise<number> {
  const rows = await sql`
    insert into agent_runs (workspace_id, user_id, type, input, parent_run_id, status)
    values (${input.workspaceId}, ${input.userId}, ${input.type}, ${JSON.stringify(input.input ?? {})}, ${input.parentRunId ?? null}, ${input.status ?? "running"})
    returning id
  `;
  return Number(rows[0].id);
}

export async function finishAgentRun(
  workspaceId: number,
  runId: number,
  outcome: { status: AgentRunStatus; output?: Record<string, unknown>; error?: string | null; tokensUsed?: number },
): Promise<void> {
  await sql`
    update agent_runs
    set status = ${outcome.status}, output = ${JSON.stringify(outcome.output ?? {})}, error = ${outcome.error ?? null},
        tokens_used = ${outcome.tokensUsed ?? 0}, completed_at = now()
    where id = ${runId} and workspace_id = ${workspaceId}
  `;
}

export async function updateAgentRunProgress(workspaceId: number, runId: number, progress: Record<string, unknown>): Promise<void> {
  await sql`update agent_runs set progress = ${JSON.stringify(progress)} where id = ${runId} and workspace_id = ${workspaceId}`;
}

/** Imports the engine's `trace[]` so the run page shows what happened inside the Python service too. */
export async function appendEngineSteps(workspaceId: number, runId: number, trace: EngineTraceStep[]): Promise<void> {
  if (trace.length === 0) return;
  await sql`
    insert into agent_run_steps (run_id, workspace_id, seq, agent, tool, input_summary, output_summary, status, duration_ms, tokens_in, tokens_out, error, started_at)
    select ${runId}, ${workspaceId}, x.seq, x.agent, x.tool, x.input_summary, x.output_summary, x.status, x.duration_ms, x.tokens_in, x.tokens_out, x.error, x.started_at
    from jsonb_to_recordset(${JSON.stringify(trace)}::jsonb) as x(
      seq int, agent text, tool text, input_summary text, output_summary text, status text, duration_ms int,
      tokens_in int, tokens_out int, error text, started_at timestamptz
    )
  `;
}
