import { sql } from "@/lib/db/client";

/** Minimum days between any two sends to the same lead, across all campaigns/channels. */
export const CHANNEL_COOLDOWN_DAYS = 14;

export type ComplianceBlockReason = "do_not_contact" | "cooldown";

export async function getDoNotContactEmails(workspaceId: number): Promise<Set<string>> {
  const rows = await sql`select lower(email) as email from do_not_contact where workspace_id = ${workspaceId}`;
  return new Set(rows.map((r) => r.email as string));
}

export async function isOnDoNotContact(workspaceId: number, email: string): Promise<boolean> {
  const rows = await sql`
    select 1 from do_not_contact where workspace_id = ${workspaceId} and lower(email) = lower(${email})
  `;
  return rows.length > 0;
}

/** Lead IDs sent to within the cooldown window — regardless of campaign or channel. */
export async function getLeadsInCooldown(
  workspaceId: number,
  leadIds: number[],
  cooldownDays: number = CHANNEL_COOLDOWN_DAYS
): Promise<Set<number>> {
  if (leadIds.length === 0) return new Set();

  const rows = await sql.query(
    `select distinct lead_id
     from campaign_sends
     where workspace_id = $1
       and lead_id = any($2::bigint[])
       and status in ('sent', 'queued')
       and coalesce(sent_at, scheduled_at) >= now() - ($3 || ' days')::interval`,
    [workspaceId, leadIds, cooldownDays]
  );
  return new Set(rows.map((r) => r.lead_id as number));
}

export type ComplianceCheckResult<T> = {
  allowed: T[];
  blocked: { lead: T; reason: ComplianceBlockReason }[];
};

/**
 * The enrollment-time gate (CRM-06): every lead entering a campaign is checked
 * against DNC and the cross-campaign cooldown before any send is scheduled.
 */
export async function filterCompliantLeads<T extends { id: number; email: string | null }>(
  workspaceId: number,
  leads: T[]
): Promise<ComplianceCheckResult<T>> {
  const dnc = await getDoNotContactEmails(workspaceId);
  const cooldown = await getLeadsInCooldown(
    workspaceId,
    leads.map((l) => l.id)
  );

  const allowed: T[] = [];
  const blocked: { lead: T; reason: ComplianceBlockReason }[] = [];

  for (const lead of leads) {
    if (lead.email && dnc.has(lead.email.toLowerCase())) {
      blocked.push({ lead, reason: "do_not_contact" });
    } else if (cooldown.has(lead.id)) {
      blocked.push({ lead, reason: "cooldown" });
    } else {
      allowed.push(lead);
    }
  }

  return { allowed, blocked };
}
