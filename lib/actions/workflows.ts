"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";

export type WorkflowNodeType = "source" | "email" | "linkedin_dm";

export type WorkflowCanvasNode = {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowCanvasEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowCanvas = {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

export type WorkflowStep = {
  channel: string;
  waitDays: number;
  subject: string | null;
  body: string;
};

export type WorkflowSummary = {
  id: number;
  name: string;
  stepCount: number;
  sourceLabel: string;
  updatedAt: string;
};

export type WorkflowDetail = {
  id: number;
  name: string;
  sourceType: "segment" | "all_leads";
  sourceSegmentId: number | null;
  canvas: WorkflowCanvas;
  steps: WorkflowStep[];
};

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select
      w.id, w.name, w.updated_at, w.source_type,
      s.name as segment_name,
      (select count(*)::int from workflow_steps ws where ws.workflow_id = w.id) as step_count
    from workflows w
    left join segments s on s.id = w.source_segment_id
    where w.workspace_id = ${workspaceId}
    order by w.updated_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    stepCount: r.step_count as number,
    sourceLabel: r.source_type === "segment" ? (r.segment_name as string) || "Saved segment" : "All qualified leads",
    updatedAt: r.updated_at as string,
  }));
}

export async function getWorkflow(id: number): Promise<WorkflowDetail> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, name, source_type, source_segment_id, canvas
    from workflows
    where id = ${id} and workspace_id = ${workspaceId}
  `;
  if (rows.length === 0) throw new Error("Workflow not found");
  const w = rows[0];

  const stepRows = await sql`
    select channel, wait_days, subject, body
    from workflow_steps
    where workflow_id = ${id}
    order by step_order asc
  `;

  return {
    id: w.id as number,
    name: w.name as string,
    sourceType: (w.source_type as string) === "segment" ? "segment" : "all_leads",
    sourceSegmentId: w.source_segment_id as number | null,
    canvas: w.canvas as WorkflowCanvas,
    steps: stepRows.map((s) => ({
      channel: s.channel as string,
      waitDays: s.wait_days as number,
      subject: s.subject as string | null,
      body: s.body as string,
    })),
  };
}

/**
 * The canvas is a real graph (nodes can be placed and connected however the
 * user drags them), but execution is linear — a campaign's step order can't
 * express branches. Rather than build a branching execution engine, this
 * walks the graph from the single source node and rejects anything that
 * isn't a straight chain, with a specific reason. Keeps the builder visual
 * and flexible to arrange, while keeping what actually runs unambiguous.
 */
function linearizeCanvas(canvas: WorkflowCanvas): {
  sourceType: "segment" | "all_leads";
  sourceSegmentId: number | null;
  steps: WorkflowStep[];
} {
  const sourceNodes = canvas.nodes.filter((n) => n.type === "source");
  if (sourceNodes.length === 0) throw new Error("Add a Lead List / Audience source node to start the flow.");
  if (sourceNodes.length > 1) throw new Error("Only one source node is allowed per workflow.");
  const sourceNode = sourceNodes[0];

  const outgoingFrom = (nodeId: string) => canvas.edges.filter((e) => e.source === nodeId);

  const visited = new Set<string>();
  const ordered: WorkflowCanvasNode[] = [];
  let current = sourceNode;

  while (true) {
    const outs = outgoingFrom(current.id);
    if (outs.length > 1) {
      throw new Error(
        "One of your steps has more than one connection out — only straight-line sequences are supported right now. Remove the extra connection."
      );
    }
    if (outs.length === 0) break;
    const nextId = outs[0].target;
    if (nextId === sourceNode.id || visited.has(nextId)) {
      throw new Error("This flow loops back on itself — remove the connection that creates the cycle.");
    }
    const nextNode = canvas.nodes.find((n) => n.id === nextId);
    if (!nextNode) throw new Error("A connection points to a step that no longer exists.");
    visited.add(nextId);
    ordered.push(nextNode);
    current = nextNode;
  }

  const actionNodeIds = canvas.nodes.filter((n) => n.type !== "source").map((n) => n.id);
  const unreached = actionNodeIds.filter((id) => !visited.has(id));
  if (unreached.length > 0) {
    throw new Error("Every step must be connected in sequence — some steps aren't linked to the flow yet.");
  }
  if (ordered.length === 0) {
    throw new Error("Add at least one step after the source and connect it.");
  }

  const sourceData = sourceNode.data as { sourceType?: string; segmentId?: number | null };
  const steps: WorkflowStep[] = ordered.map((n) => {
    const data = n.data as { waitDays?: number; subject?: string; body?: string };
    return {
      channel: n.type,
      waitDays: data.waitDays ?? 0,
      subject: data.subject ?? null,
      body: data.body ?? "",
    };
  });

  return {
    sourceType: sourceData.sourceType === "segment" ? "segment" : "all_leads",
    sourceSegmentId: sourceData.sourceType === "segment" ? sourceData.segmentId ?? null : null,
    steps,
  };
}

export async function saveWorkflow(input: {
  id?: number;
  name: string;
  canvas: WorkflowCanvas;
}): Promise<{ id: number }> {
  const { workspaceId, userId } = await requireRole("member");
  const name = input.name.trim();
  if (!name) throw new Error("Give the workflow a name.");

  const { sourceType, sourceSegmentId, steps } = linearizeCanvas(input.canvas);

  let workflowId: number;
  if (input.id) {
    const updated = await sql`
      update workflows set
        name = ${name}, source_type = ${sourceType}, source_segment_id = ${sourceSegmentId},
        canvas = ${JSON.stringify(input.canvas)}, updated_at = now()
      where id = ${input.id} and workspace_id = ${workspaceId}
      returning id
    `;
    if (updated.length === 0) throw new Error("Workflow not found");
    workflowId = updated[0].id as number;
    await sql`delete from workflow_steps where workflow_id = ${workflowId}`;
  } else {
    const inserted = await sql`
      insert into workflows (workspace_id, name, source_type, source_segment_id, canvas, created_by_user_id)
      values (${workspaceId}, ${name}, ${sourceType}, ${sourceSegmentId}, ${JSON.stringify(input.canvas)}, ${userId})
      returning id
    `;
    workflowId = inserted[0].id as number;
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await sql`
      insert into workflow_steps (workflow_id, step_order, channel, wait_days, subject, body)
      values (${workflowId}, ${i + 1}, ${s.channel}, ${s.waitDays}, ${s.subject}, ${s.body})
    `;
  }

  revalidatePath("/dashboard/agentic-flows");
  return { id: workflowId };
}

export async function deleteWorkflow(id: number): Promise<void> {
  const { workspaceId } = await requireRole("member");
  const rows = await sql`delete from workflows where id = ${id} and workspace_id = ${workspaceId} returning id`;
  if (rows.length === 0) throw new Error("Workflow not found");
  revalidatePath("/dashboard/agentic-flows");
}
