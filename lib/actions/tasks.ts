"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";

export type TaskQueue = "my_open" | "today" | "overdue" | "ai_recommended" | "completed" | "dismissed";

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: "open" | "completed" | "dismissed";
  source: string;
  dueAt: string | null;
  ownerName: string | null;
  ownerUserId: number | null;
  completedAt: string | null;
  outcome: string | null;
  createdAt: string;
};

const QUEUE_CLAUSE: Record<TaskQueue, string> = {
  my_open: "t.status = 'open' and t.owner_user_id = $2",
  today: "t.status = 'open' and t.due_at::date = current_date",
  overdue: "t.status = 'open' and t.due_at is not null and t.due_at < now()",
  ai_recommended: "t.status = 'open' and t.source = 'agent_generated'",
  completed: "t.status = 'completed'",
  dismissed: "t.status = 'dismissed'",
};

export async function listTasks(queue: TaskQueue): Promise<Task[]> {
  const { workspaceId, userId } = await requireRole("viewer");

  const clause = QUEUE_CLAUSE[queue];
  const params = clause.includes("$2") ? [workspaceId, userId] : [workspaceId];

  const rows = await sql.query(
    `select t.id, t.title, t.description, t.status, t.source, t.due_at, t.completed_at, t.outcome,
            t.owner_user_id, u.name as owner_name
     from tasks t
     left join users u on u.id = t.owner_user_id
     where t.workspace_id = $1 and ${clause}
     order by t.due_at asc nulls last, t.created_at desc
     limit 200`,
    params
  );

  return rows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    description: r.description as string | null,
    status: r.status as Task["status"],
    source: r.source as string,
    dueAt: r.due_at as string | null,
    ownerUserId: r.owner_user_id as number | null,
    ownerName: r.owner_name as string | null,
    completedAt: r.completed_at as string | null,
    outcome: r.outcome as string | null,
    createdAt: r.created_at as string,
  }));
}

export async function getQueueCounts(): Promise<Record<TaskQueue, number>> {
  const { workspaceId, userId } = await requireRole("viewer");

  const rows = await sql`
    select
      count(*) filter (where status = 'open' and owner_user_id = ${userId}) as my_open,
      count(*) filter (where status = 'open' and due_at::date = current_date) as today,
      count(*) filter (where status = 'open' and due_at is not null and due_at < now()) as overdue,
      count(*) filter (where status = 'open' and source = 'agent_generated') as ai_recommended,
      count(*) filter (where status = 'completed') as completed,
      count(*) filter (where status = 'dismissed') as dismissed
    from tasks
    where workspace_id = ${workspaceId}
  `;
  const r = rows[0];
  return {
    my_open: Number(r.my_open),
    today: Number(r.today),
    overdue: Number(r.overdue),
    ai_recommended: Number(r.ai_recommended),
    completed: Number(r.completed),
    dismissed: Number(r.dismissed),
  };
}

export async function createTask(input: { title: string; description?: string; dueAt?: string | null }) {
  const { workspaceId, userId } = await requireRole("member");
  if (!input.title.trim()) throw new Error("Task needs a title");

  const inserted = await sql`
    insert into tasks (workspace_id, title, description, due_at, source, owner_user_id, created_by_user_id)
    values (${workspaceId}, ${input.title.trim()}, ${input.description?.trim() || null}, ${input.dueAt || null}, 'manual', ${userId}, ${userId})
    returning id
  `;
  const taskId = inserted[0].id as number;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "task.created",
    entityType: "task",
    entityId: taskId,
    summary: `Created task "${input.title.trim()}"`,
  });

  revalidatePath("/dashboard/tasks");
  return { id: taskId };
}

/** TASK-02: completion always records actor, timestamp, outcome, in the immutable activity stream. */
export async function completeTask(id: number, outcome?: string) {
  const { workspaceId, userId } = await requireRole("member");

  const rows = await sql`
    update tasks
    set status = 'completed', completed_at = now(), completed_by_user_id = ${userId}, outcome = ${outcome?.trim() || null}
    where id = ${id} and workspace_id = ${workspaceId}
    returning title
  `;
  if (rows.length === 0) throw new Error("Task not found");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "task.completed",
    entityType: "task",
    entityId: id,
    summary: `Completed task "${rows[0].title}"${outcome ? ` — ${outcome}` : ""}`,
  });

  revalidatePath("/dashboard/tasks");
}

export async function dismissTask(id: number) {
  const { workspaceId, userId } = await requireRole("member");

  const rows = await sql`
    update tasks set status = 'dismissed'
    where id = ${id} and workspace_id = ${workspaceId}
    returning title
  `;
  if (rows.length === 0) throw new Error("Task not found");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "task.dismissed",
    entityType: "task",
    entityId: id,
    summary: `Dismissed task "${rows[0].title}"`,
  });

  revalidatePath("/dashboard/tasks");
}
