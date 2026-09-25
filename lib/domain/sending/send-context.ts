import { sql } from "@/lib/db/client";
import { DEFAULT_SEND_WINDOW, sendWindowSchema, type SendWindow } from "@/lib/domain/campaigns/types";

/** Everything the send handler needs about one scheduled email, loaded in one query and scoped to the job's workspace. */
export type SendContext = {
  sendId: number;
  workspaceId: number;
  campaignId: number;
  campaignLeadId: number | null;
  stepOrder: number;
  subject: string;
  body: string;
  sendStatus: string;
  scheduledAt: Date;
  leadId: number;
  leadName: string;
  leadCompany: string | null;
  leadEmail: string | null;
  leadEmailStatus: string | null;
  leadSequenceStatus: string | null;
  campaignName: string;
  campaignStatus: string;
  sendModel: "legacy" | "leads";
  campaignDailyLimit: number;
  /** null = no window (legacy campaigns send whenever due, as they always did). */
  window: SendWindow | null;
  mailboxId: number | null;
  mailboxEmail: string | null;
  mailboxActive: boolean;
  domainVerified: boolean;
  mailboxDailyLimit: number;
  mailboxCreatedAt: Date;
  workspaceDailyCap: number | null;
};

export async function loadSendContext(workspaceId: number, sendId: number): Promise<SendContext | null> {
  const rows = await sql`
    select cs.id, cs.campaign_id, cs.campaign_lead_id, cs.subject, cs.body, cs.status as send_status, cs.scheduled_at, st.step_order,
           l.id as lead_id, l.full_name, l.company, l.email, l.email_status,
           c.name as campaign_name, c.status as campaign_status, c.send_model, c.daily_email_limit, c.send_window, c.mailbox_id,
           cl.status as sequence_status,
           m.email as mailbox_email, m.status as mailbox_status, m.daily_limit as mailbox_daily_limit, m.created_at as mailbox_created_at,
           d.status as domain_status, w.daily_send_cap
    from campaign_sends cs
    join campaign_steps st on st.id = cs.step_id
    join leads l on l.id = cs.lead_id and l.workspace_id = cs.workspace_id
    join campaigns c on c.id = cs.campaign_id and c.workspace_id = cs.workspace_id
    join workspaces w on w.id = cs.workspace_id
    left join campaign_leads cl on cl.id = cs.campaign_lead_id
    left join mailboxes m on m.id = c.mailbox_id and m.workspace_id = cs.workspace_id
    left join domains d on d.id = m.domain_id
    where cs.id = ${sendId} and cs.workspace_id = ${workspaceId} and cs.channel = 'email'`;
  const r = rows[0];
  if (!r) return null;
  const leads = r.send_model === "leads";
  const parsed = sendWindowSchema.safeParse(r.send_window ?? DEFAULT_SEND_WINDOW);
  return {
    sendId: Number(r.id), workspaceId, campaignId: Number(r.campaign_id), campaignLeadId: r.campaign_lead_id === null ? null : Number(r.campaign_lead_id),
    stepOrder: Number(r.step_order), subject: String(r.subject ?? ""), body: String(r.body), sendStatus: String(r.send_status), scheduledAt: new Date(String(r.scheduled_at)),
    leadId: Number(r.lead_id), leadName: String(r.full_name), leadCompany: (r.company as string | null) ?? null, leadEmail: (r.email as string | null) ?? null,
    leadEmailStatus: (r.email_status as string | null) ?? null, leadSequenceStatus: (r.sequence_status as string | null) ?? null,
    campaignName: String(r.campaign_name), campaignStatus: String(r.campaign_status), sendModel: leads ? "leads" : "legacy",
    campaignDailyLimit: Number(r.daily_email_limit), window: leads ? (parsed.success ? parsed.data : DEFAULT_SEND_WINDOW) : null,
    mailboxId: r.mailbox_id === null ? null : Number(r.mailbox_id), mailboxEmail: (r.mailbox_email as string | null) ?? null,
    mailboxActive: r.mailbox_status === "active", domainVerified: r.domain_status === "verified",
    mailboxDailyLimit: Number(r.mailbox_daily_limit ?? 50), mailboxCreatedAt: new Date(String(r.mailbox_created_at ?? new Date(0).toISOString())),
    workspaceDailyCap: r.daily_send_cap === null || r.daily_send_cap === undefined ? null : Number(r.daily_send_cap),
  };
}

export type MessageRow = {
  id: number;
  status: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  fromEmail: string;
  toEmail: string;
  idempotencyKey: string;
  claimedAt: Date;
  attempts: number;
  providerMessageId: string | null;
};

export async function loadMessageForSend(workspaceId: number, sendId: number): Promise<MessageRow | null> {
  const rows = await sql`select * from messages where campaign_send_id = ${sendId} and workspace_id = ${workspaceId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id), status: String(r.status), subject: String(r.subject), body: String(r.body), headers: (r.headers ?? {}) as Record<string, string>,
    fromEmail: String(r.from_email), toEmail: String(r.to_email), idempotencyKey: String(r.idempotency_key), claimedAt: new Date(String(r.claimed_at)),
    attempts: Number(r.attempts), providerMessageId: (r.provider_message_id as string | null) ?? null,
  };
}
