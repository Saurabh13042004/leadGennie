import { sql } from "@/lib/db/client";

export type UsageItem = {
  kind: "llm" | "search" | "fetch" | "provider" | "ai_generation";
  provider: string;
  model?: string | null;
  units?: number;
  tokensIn?: number;
  tokensOut?: number;
  costEstimate?: number;
};

/** Append-only metering (single writer: this app). One multi-row insert; a failure to meter never fails the work. */
export async function recordUsage(
  ctx: { workspaceId: number; userId: number | null },
  items: UsageItem[],
  ref: { type?: string; id?: number | null; agentRunId?: number | null } = {},
): Promise<void> {
  if (items.length === 0) return;
  await sql`
    insert into usage_records (workspace_id, user_id, kind, provider, model, units, tokens_in, tokens_out, cost_estimate, ref_type, ref_id, agent_run_id)
    select ${ctx.workspaceId}, ${ctx.userId}, x.kind, x.provider, x.model, x.units, x.tokens_in, x.tokens_out, x.cost_estimate,
           ${ref.type ?? null}, ${ref.id ?? null}, ${ref.agentRunId ?? null}
    from jsonb_to_recordset(${JSON.stringify(
      items.map((i) => ({
        kind: i.kind, provider: i.provider, model: i.model ?? null, units: i.units ?? 1,
        tokens_in: i.tokensIn ?? 0, tokens_out: i.tokensOut ?? 0, cost_estimate: i.costEstimate ?? 0,
      })),
    )}::jsonb) as x(kind text, provider text, model text, units numeric, tokens_in int, tokens_out int, cost_estimate numeric)
  `;
}
