import { sql } from "@/lib/db/client";

/** Statuses that count against limits: the email went out, or is in flight and may have gone out. */
const COUNTED = "('sending', 'sent', 'delivered', 'bounced', 'complained')";

export type GateCounts = { campaignToday: number; mailboxToday: number; workspaceToday: number; domainLastHour: number; mailboxLastClaimAt: Date | null };

export async function loadGateCounts(a: {
  workspaceId: number;
  campaignId: number;
  mailboxId: number;
  recipientDomain: string;
  campaignDayStart: Date;
  utcDayStart: Date;
  now: Date;
}): Promise<GateCounts> {
  const [r] = await sql.query(
    `select
       (select count(*)::int from messages m where m.campaign_id = $2 and m.workspace_id = $1 and m.status in ${COUNTED} and m.claimed_at >= $5::timestamptz) as campaign_today,
       (select count(*)::int from messages m where m.mailbox_id = $3 and m.workspace_id = $1 and m.status in ${COUNTED} and m.claimed_at >= $6::timestamptz) as mailbox_today,
       (select count(*)::int from messages m where m.workspace_id = $1 and m.status in ${COUNTED} and m.claimed_at >= $6::timestamptz) as workspace_today,
       (select count(*)::int from messages m where m.workspace_id = $1 and m.to_domain = $4 and m.status in ${COUNTED} and m.claimed_at >= $7::timestamptz - interval '1 hour') as domain_last_hour,
       (select max(m.claimed_at) from messages m where m.mailbox_id = $3 and m.workspace_id = $1 and m.status in ${COUNTED}) as last_claim`,
    [a.workspaceId, a.campaignId, a.mailboxId, a.recipientDomain, a.campaignDayStart.toISOString(), a.utcDayStart.toISOString(), a.now.toISOString()],
  );
  return {
    campaignToday: Number(r.campaign_today), mailboxToday: Number(r.mailbox_today), workspaceToday: Number(r.workspace_today),
    domainLastHour: Number(r.domain_last_hour), mailboxLastClaimAt: r.last_claim ? new Date(String(r.last_claim)) : null,
  };
}

export type ClaimInput = {
  workspaceId: number;
  campaignId: number;
  campaignLeadId: number | null;
  sendId: number;
  leadId: number;
  mailboxId: number;
  /** The mailbox's provider key (`resend`, `gmail`, `microsoft`) — stored on the message so events and threads are correlated correctly. */
  provider: string;
  subject: string;
  body: string;
  headers: Record<string, string>;
  fromEmail: string;
  toEmail: string;
  toDomain: string;
  idempotencyKey: string;
  now: Date;
  limits: { campaign: number; mailbox: number; workspace: number | null; domainHourly: number | null; spacingSeconds: number };
  campaignDayStart: Date;
  utcDayStart: Date;
};

/**
 * Message-BEFORE-send, with the hard caps re-verified inside the same statement.
 *
 * The gate (pure) has already said "yes" from counts it read a moment ago; between that read and this insert another
 * worker may have claimed the last slot. So the insert only happens `where` each cap still has room, and the whole thing
 * runs under a per-mailbox advisory lock inside one transaction — the lock serialises workers on a mailbox and each
 * statement sees everything committed before it (READ COMMITTED), so no two workers can both spend the last slot.
 *
 * Returns the message id, or null when a cap is full (or the send already has a message) — the caller re-runs the gate.
 * `on conflict (campaign_send_id)` makes a double-delivered job harmless: the second claim inserts nothing.
 */
export async function claimMessage(i: ClaimInput): Promise<number | null> {
  const [, inserted] = await sql.transaction([
    sql`select pg_advisory_xact_lock(${i.mailboxId})`,
    sql.query(
      `insert into messages (workspace_id, campaign_id, campaign_lead_id, campaign_send_id, lead_id, mailbox_id, subject, body, headers,
                             from_email, to_email, to_domain, provider, idempotency_key, status, attempts, claimed_at)
       select $1::bigint, $2::bigint, $3::bigint, $4::bigint, $5::bigint, $6::bigint, $7::text, $8::text, $9::jsonb,
              $10::text, $11::text, $12::text, $22::text, $13::text, 'sending', 0, $14::timestamptz
       where (select count(*) from messages m where m.campaign_id = $2::bigint and m.status in ${COUNTED} and m.claimed_at >= $15::timestamptz) < $16::int
         and (select count(*) from messages m where m.mailbox_id = $6::bigint and m.status in ${COUNTED} and m.claimed_at >= $17::timestamptz) < $18::int
         and ($19::int is null or (select count(*) from messages m where m.workspace_id = $1::bigint and m.status in ${COUNTED} and m.claimed_at >= $17::timestamptz) < $19::int)
         and ($20::int is null or (select count(*) from messages m where m.workspace_id = $1::bigint and m.to_domain = $12::text and m.status in ${COUNTED} and m.claimed_at >= $14::timestamptz - interval '1 hour') < $20::int)
         and ($21::int <= 0 or not exists (select 1 from messages m where m.mailbox_id = $6::bigint and m.status in ${COUNTED} and m.claimed_at > $14::timestamptz - ($21::int * interval '1 second')))
       on conflict (campaign_send_id) where campaign_send_id is not null do nothing
       returning id`,
      [
        i.workspaceId, i.campaignId, i.campaignLeadId, i.sendId, i.leadId, i.mailboxId, i.subject, i.body, JSON.stringify(i.headers),
        i.fromEmail, i.toEmail, i.toDomain, i.idempotencyKey, i.now.toISOString(), i.campaignDayStart.toISOString(), i.limits.campaign,
        i.utcDayStart.toISOString(), i.limits.mailbox, i.limits.workspace, i.limits.domainHourly, i.limits.spacingSeconds, i.provider,
      ],
    ),
  ]);
  return inserted.length > 0 ? Number(inserted[0].id) : null;
}
