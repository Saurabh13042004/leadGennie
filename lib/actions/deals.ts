"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";

export type Stage = {
  id: number;
  name: string;
  stageKey: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
};

export type Pipeline = {
  id: number;
  name: string;
  stages: Stage[];
};

const DEFAULT_STAGES = [
  { key: "new", name: "New", isWon: false, isLost: false },
  { key: "contacted", name: "Contacted", isWon: false, isLost: false },
  { key: "qualified", name: "Qualified", isWon: false, isLost: false },
  { key: "proposal", name: "Proposal", isWon: false, isLost: false },
  { key: "won", name: "Won", isWon: true, isLost: false },
  { key: "lost", name: "Lost", isWon: false, isLost: true },
];

/** DEAL-02: pipelines/stages are workspace-defined, not hardcoded — this just provisions sensible defaults once. */
async function getOrCreateDefaultPipeline(workspaceId: number): Promise<Pipeline> {
  const existing = await sql`
    select id, name from pipelines where workspace_id = ${workspaceId} and is_default = true limit 1
  `;

  let pipelineId: number;
  let pipelineName: string;

  if (existing.length > 0) {
    pipelineId = existing[0].id as number;
    pipelineName = existing[0].name as string;
  } else {
    const inserted = await sql`
      insert into pipelines (workspace_id, name, is_default) values (${workspaceId}, 'Sales Pipeline', true)
      returning id, name
    `;
    pipelineId = inserted[0].id as number;
    pipelineName = inserted[0].name as string;

    for (let i = 0; i < DEFAULT_STAGES.length; i++) {
      const s = DEFAULT_STAGES[i];
      await sql`
        insert into pipeline_stages (pipeline_id, workspace_id, stage_key, name, sort_order, is_won, is_lost)
        values (${pipelineId}, ${workspaceId}, ${s.key}, ${s.name}, ${i}, ${s.isWon}, ${s.isLost})
      `;
    }
  }

  const stageRows = await sql`
    select id, stage_key, name, sort_order, is_won, is_lost
    from pipeline_stages
    where pipeline_id = ${pipelineId}
    order by sort_order asc
  `;

  return {
    id: pipelineId,
    name: pipelineName,
    stages: stageRows.map((r) => ({
      id: r.id as number,
      stageKey: r.stage_key as string,
      name: r.name as string,
      sortOrder: r.sort_order as number,
      isWon: r.is_won as boolean,
      isLost: r.is_lost as boolean,
    })),
  };
}

export async function getPipeline(): Promise<Pipeline> {
  const { workspaceId } = await requireRole("viewer");
  return getOrCreateDefaultPipeline(workspaceId);
}

export type Deal = {
  id: number;
  name: string;
  value: number;
  probability: number;
  status: "open" | "won" | "lost";
  stageId: number;
  stageName: string;
  leadId: number | null;
  leadName: string | null;
  accountCompany: string | null;
  ownerName: string | null;
  expectedCloseDate: string | null;
  source: string;
  createdAt: string;
};

export async function listDeals(): Promise<Deal[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select
      d.id, d.name, d.value, d.probability, d.status, d.stage_id, ps.name as stage_name,
      d.lead_id, l.full_name as lead_name, d.account_company, u.name as owner_name,
      d.expected_close_date, d.source, d.created_at
    from deals d
    join pipeline_stages ps on ps.id = d.stage_id
    left join leads l on l.id = d.lead_id
    left join users u on u.id = d.owner_user_id
    where d.workspace_id = ${workspaceId}
    order by d.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    value: Number(r.value),
    probability: r.probability as number,
    status: r.status as Deal["status"],
    stageId: r.stage_id as number,
    stageName: r.stage_name as string,
    leadId: r.lead_id as number | null,
    leadName: r.lead_name as string | null,
    accountCompany: r.account_company as string | null,
    ownerName: r.owner_name as string | null,
    expectedCloseDate: r.expected_close_date as string | null,
    source: r.source as string,
    createdAt: r.created_at as string,
  }));
}

export type RecommendedDeal = {
  name: string;
  value: number;
  probability: number;
  accountCompany: string | null;
};

/** AI may recommend — never create. The form this fills is only ever submitted by an explicit user action (DEAL-01). */
export async function recommendDealForLead(leadId: number): Promise<RecommendedDeal> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select full_name, company, job_title from leads where id = ${leadId} and workspace_id = ${workspaceId}
  `;
  const lead = rows[0];
  if (!lead) throw new Error("Lead not found");

  const company = lead.company as string | null;
  const title = ((lead.job_title as string | null) ?? "").toLowerCase();
  const isSenior = /\b(vp|chief|head|director|founder|ceo|cto|coo)\b/.test(title);

  return {
    name: `${company || lead.full_name} opportunity`,
    value: isSenior ? 15000 : 5000,
    probability: isSenior ? 40 : 25,
    accountCompany: company,
  };
}

export type CreateDealInput = {
  name: string;
  value: number;
  probability: number;
  stageId: number;
  leadId?: number | null;
  accountCompany?: string | null;
  expectedCloseDate?: string | null;
  source?: "manual" | "ai_recommended";
};

/** DEAL-01: only ever called from an explicit, authenticated user action — there is no automatic deal creation anywhere in this codebase. */
export async function createDeal(input: CreateDealInput) {
  const { workspaceId, userId } = await requireRole("member");

  const stage = await sql`
    select id, is_won, is_lost from pipeline_stages where id = ${input.stageId} and workspace_id = ${workspaceId}
  `;
  if (stage.length === 0) throw new Error("Invalid stage for this workspace");

  const status = stage[0].is_won ? "won" : stage[0].is_lost ? "lost" : "open";

  const inserted = await sql`
    insert into deals (
      workspace_id, pipeline_id, stage_id, name, value, probability, status,
      lead_id, account_company, owner_user_id, expected_close_date, source, created_by_user_id
    )
    select
      ${workspaceId}, ps.pipeline_id, ${input.stageId}, ${input.name}, ${input.value}, ${input.probability}, ${status},
      ${input.leadId ?? null}, ${input.accountCompany ?? null}, ${userId}, ${input.expectedCloseDate ?? null},
      ${input.source ?? "manual"}, ${userId}
    from pipeline_stages ps where ps.id = ${input.stageId}
    returning id
  `;
  const dealId = inserted[0].id as number;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "deal.created",
    entityType: "deal",
    entityId: dealId,
    summary: `Created deal "${input.name}"`,
    metadata: { source: input.source ?? "manual", value: input.value },
  });

  revalidatePath("/dashboard/deals");
  return { id: dealId };
}

/** DEAL-02/03: a stage change validates required fields for that stage before committing. */
export async function updateDealStage(dealId: number, newStageId: number) {
  const { workspaceId, userId } = await requireRole("member");

  const dealRows = await sql`
    select value, stage_id from deals where id = ${dealId} and workspace_id = ${workspaceId}
  `;
  const deal = dealRows[0];
  if (!deal) throw new Error("Deal not found");

  const stageRows = await sql`
    select id, name, is_won, is_lost from pipeline_stages where id = ${newStageId} and workspace_id = ${workspaceId}
  `;
  const stage = stageRows[0];
  if (!stage) throw new Error("Invalid stage for this workspace");

  if (stage.is_won && Number(deal.value) <= 0) {
    throw new Error('A deal needs a value greater than $0 before it can move to a "Won" stage.');
  }

  const status = stage.is_won ? "won" : stage.is_lost ? "lost" : "open";

  await sql`
    update deals set stage_id = ${newStageId}, status = ${status}, updated_at = now()
    where id = ${dealId} and workspace_id = ${workspaceId}
  `;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "deal.stage_changed",
    entityType: "deal",
    entityId: dealId,
    summary: `Moved deal to "${stage.name}"`,
  });

  revalidatePath("/dashboard/deals");
}
