import { sql } from "@/lib/db/client";
import { localDayStart } from "@/lib/domain/campaigns/schedule";
import { now as clockNow } from "@/lib/domain/sending/clock";
import { mailboxBlockedReason, type Mailbox, type MailboxProviderKey, type MailboxStatus } from "./types";

/**
 * All mailbox SQL. Every statement is scoped by `workspace_id`.
 *
 * Two deliberately separate read paths:
 *  · `listMailboxes` / `getMailbox` — what the UI and services see. They never select a credential column.
 *  · `loadSecrets` — the ONLY reader of `access_token_enc` / `refresh_token_enc`; used by the token source and by disconnect.
 */

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

function toMailbox(r: Record<string, unknown>): Mailbox {
  const provider = String(r.provider) as MailboxProviderKey;
  const status = String(r.status) as MailboxStatus;
  const domainStatus = (r.domain_status as string | null) ?? null;
  const blockedReason = mailboxBlockedReason({ provider, status, domainStatus });
  return {
    id: Number(r.id), email: String(r.email), displayName: (r.display_name as string | null) ?? null, provider, status, dailyLimit: Number(r.daily_limit),
    sentToday: Number(r.sent_today), domainId: r.domain_id === null ? null : Number(r.domain_id), domainName: (r.domain_name as string | null) ?? null, domainStatus,
    approvalId: r.approval_id === null ? null : Number(r.approval_id), ownerUserId: r.owner_user_id === null ? null : Number(r.owner_user_id),
    lastError: (r.last_error as string | null) ?? null, connectedAt: iso(r.connected_at), lastSyncedAt: iso(r.last_synced_at), createdAt: iso(r.created_at)!,
    activeCampaigns: Number(r.active_campaigns), sendable: blockedReason === null, blockedReason,
  };
}

/** `mailboxId` narrows to one; null lists the workspace. */
async function select(workspaceId: number, mailboxId: number | null): Promise<Mailbox[]> {
  const dayStart = localDayStart(clockNow(), "UTC").toISOString();
  const rows = await sql`
    select m.id, m.email, m.display_name, m.provider, m.status, m.daily_limit, m.domain_id, m.approval_id, m.owner_user_id, m.last_error,
           m.connected_at, m.last_synced_at, m.created_at, d.name as domain_name, d.status as domain_status,
           (select count(*)::int from messages ms where ms.mailbox_id = m.id and ms.workspace_id = m.workspace_id
              -- the same statuses the send gate counts (lib/domain/sending/claim.ts)
              and ms.status in ('sending', 'sent', 'delivered', 'bounced', 'complained') and ms.claimed_at >= ${dayStart}::timestamptz) as sent_today,
           (select count(*)::int from campaigns c where c.mailbox_id = m.id and c.workspace_id = m.workspace_id and c.status = 'running') as active_campaigns
    from mailboxes m
    left join domains d on d.id = m.domain_id and d.workspace_id = m.workspace_id
    where m.workspace_id = ${workspaceId} and (${mailboxId}::bigint is null or m.id = ${mailboxId})
    order by m.created_at desc`;
  return rows.map(toMailbox);
}

export const listMailboxes = (workspaceId: number) => select(workspaceId, null);
export async function getMailbox(workspaceId: number, mailboxId: number): Promise<Mailbox | null> {
  return (await select(workspaceId, mailboxId))[0] ?? null;
}

// ---- credentials -----------------------------------------------------------------------------------------------------

/** Ciphertext as stored. Decrypting is `token-source.ts`'s job, so plaintext tokens exist only in that module's memory. */
export type MailboxSecrets = {
  id: number;
  provider: MailboxProviderKey;
  status: MailboxStatus;
  email: string;
  displayName: string | null;
  providerAccountId: string | null;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  tokenVersion: number;
  scopes: string[];
  ownerUserId: number | null;
};

export async function loadSecrets(workspaceId: number, mailboxId: number): Promise<MailboxSecrets | null> {
  const rows = await sql`
    select id, provider, status, email, display_name, provider_account_id, access_token_enc, refresh_token_enc, token_expires_at, token_version, scopes, owner_user_id
    from mailboxes where id = ${mailboxId} and workspace_id = ${workspaceId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id), provider: String(r.provider) as MailboxProviderKey, status: String(r.status) as MailboxStatus, email: String(r.email),
    displayName: (r.display_name as string | null) ?? null, providerAccountId: (r.provider_account_id as string | null) ?? null,
    accessTokenEnc: (r.access_token_enc as string | null) ?? null, refreshTokenEnc: (r.refresh_token_enc as string | null) ?? null,
    tokenExpiresAt: r.token_expires_at ? new Date(String(r.token_expires_at)) : null, tokenVersion: Number(r.token_version),
    scopes: (r.scopes as string[] | null) ?? [], ownerUserId: r.owner_user_id === null ? null : Number(r.owner_user_id),
  };
}

/**
 * Stores refreshed tokens IF nobody refreshed since `expectedVersion` was read (compare-and-swap on `token_version`). The HTTP
 * driver has no row locks, and Microsoft rotates refresh tokens — two workers both refreshing must not overwrite each other's
 * newer token with an older one. Returns false when it lost the race (the caller re-reads the winner's tokens).
 */
export async function saveRefreshedTokens(
  workspaceId: number, mailboxId: number, expectedVersion: number,
  t: { accessTokenEnc: string; refreshTokenEnc: string | null; expiresAt: Date; scopes: string[] },
): Promise<boolean> {
  const rows = await sql`
    update mailboxes set access_token_enc = ${t.accessTokenEnc}, refresh_token_enc = coalesce(${t.refreshTokenEnc}, refresh_token_enc),
           token_expires_at = ${t.expiresAt.toISOString()}::timestamptz, scopes = case when cardinality(${t.scopes}::text[]) > 0 then ${t.scopes}::text[] else scopes end,
           token_version = token_version + 1, updated_at = now()
    where id = ${mailboxId} and workspace_id = ${workspaceId} and token_version = ${expectedVersion} and status in ('active', 'error') returning id`;
  return rows.length > 0;
}

export type ConnectionInput = {
  provider: MailboxProviderKey;
  email: string;
  displayName: string | null;
  providerAccountId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date;
  scopes: string[];
  ownerUserId: number;
  dailyLimit: number;
};

export async function insertConnection(workspaceId: number, c: ConnectionInput): Promise<number> {
  const rows = await sql`
    insert into mailboxes (workspace_id, provider, email, display_name, provider_account_id, status, daily_limit, owner_user_id, created_by_user_id,
                           access_token_enc, refresh_token_enc, token_expires_at, scopes, connected_at)
    values (${workspaceId}, ${c.provider}, ${c.email}, ${c.displayName}, ${c.providerAccountId}, 'active', ${c.dailyLimit}, ${c.ownerUserId}, ${c.ownerUserId},
            ${c.accessTokenEnc}, ${c.refreshTokenEnc}, ${c.tokenExpiresAt.toISOString()}::timestamptz, ${c.scopes}::text[], now())
    returning id`;
  return Number(rows[0].id);
}

/** Puts a fresh connection on an existing row (reconnect). Keeps the old refresh token when the provider issued no new one. */
export async function replaceConnection(workspaceId: number, mailboxId: number, c: Pick<ConnectionInput, "displayName" | "accessTokenEnc" | "refreshTokenEnc" | "tokenExpiresAt" | "scopes">): Promise<boolean> {
  const rows = await sql`
    update mailboxes set status = 'active', display_name = coalesce(${c.displayName}, display_name), access_token_enc = ${c.accessTokenEnc},
           refresh_token_enc = coalesce(${c.refreshTokenEnc}, refresh_token_enc), token_expires_at = ${c.tokenExpiresAt.toISOString()}::timestamptz,
           scopes = ${c.scopes}::text[], token_version = token_version + 1, last_error = null, connected_at = now(), disconnected_at = null, updated_at = now()
    where id = ${mailboxId} and workspace_id = ${workspaceId} and provider <> 'resend' returning id`;
  return rows.length > 0;
}

export async function findByAccount(workspaceId: number, provider: MailboxProviderKey, providerAccountId: string): Promise<{ id: number; email: string; status: MailboxStatus } | null> {
  const rows = await sql`select id, email, status from mailboxes where workspace_id = ${workspaceId} and provider = ${provider} and provider_account_id = ${providerAccountId}`;
  return rows[0] ? { id: Number(rows[0].id), email: String(rows[0].email), status: String(rows[0].status) as MailboxStatus } : null;
}

export async function findByEmail(workspaceId: number, email: string): Promise<{ id: number; provider: MailboxProviderKey } | null> {
  const rows = await sql`select id, provider from mailboxes where workspace_id = ${workspaceId} and lower(email) = ${email.toLowerCase()}`;
  return rows[0] ? { id: Number(rows[0].id), provider: String(rows[0].provider) as MailboxProviderKey } : null;
}

// ---- status ----------------------------------------------------------------------------------------------------------

/**
 * Moves a mailbox to `to` only if it is currently in one of `from` (so two racing writers can't both win, and a stale click
 * can't resurrect a disconnected mailbox). Returns the mailbox's email, or null if nothing matched.
 */
export async function moveStatus(workspaceId: number, mailboxId: number, from: readonly MailboxStatus[], to: MailboxStatus, lastError: string | null): Promise<{ email: string; provider: MailboxProviderKey } | null> {
  const rows = await sql`
    update mailboxes set status = ${to}, last_error = ${lastError}, updated_at = now()
    where id = ${mailboxId} and workspace_id = ${workspaceId} and status = any(${[...from]}::text[]) returning email, provider`;
  return rows[0] ? { email: String(rows[0].email), provider: String(rows[0].provider) as MailboxProviderKey } : null;
}

/** Disconnect: forget the credentials in the same statement that changes the status, so a disconnected row never holds a usable token. */
export async function clearConnection(workspaceId: number, mailboxId: number): Promise<{ email: string } | null> {
  const rows = await sql`
    update mailboxes set status = 'disconnected', access_token_enc = null, refresh_token_enc = null, token_expires_at = null, token_version = token_version + 1,
           disconnected_at = now(), last_error = null, updated_at = now()
    where id = ${mailboxId} and workspace_id = ${workspaceId} and provider <> 'resend' and status <> 'disconnected' returning email`;
  return rows[0] ? { email: String(rows[0].email) } : null;
}

export async function listRunningCampaigns(workspaceId: number, mailboxId: number): Promise<{ id: number; name: string }[]> {
  const rows = await sql`select id, name from campaigns where workspace_id = ${workspaceId} and mailbox_id = ${mailboxId} and status = 'running'`;
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}
