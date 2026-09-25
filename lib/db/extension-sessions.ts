import { sql } from "@/lib/db/client";
import type { Role } from "@/lib/workspace";

/** Persistence for the extension connect flow. Codes and tokens are only ever handled as SHA-256 hashes. */

export type AuthCodeRow = {
  workspaceId: number;
  userId: number;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  deviceLabel: string | null;
};

export async function insertAuthCode(input: {
  workspaceId: number;
  userId: number;
  codeHash: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  deviceLabel: string | null;
  expiresAt: Date;
}): Promise<void> {
  await sql`
    insert into extension_auth_codes (workspace_id, user_id, code_hash, code_challenge, redirect_uri, scopes, device_label, expires_at)
    values (${input.workspaceId}, ${input.userId}, ${input.codeHash}, ${input.codeChallenge}, ${input.redirectUri},
            ${input.scopes}::text[], ${input.deviceLabel}, ${input.expiresAt.toISOString()})
  `;
}

/**
 * Atomically consumes a code: it can be exchanged exactly once, and only before it expires. A wrong PKCE
 * verifier afterwards still leaves the code burned — an attacker gets one guess, not unlimited retries.
 */
export async function consumeAuthCode(codeHash: string): Promise<AuthCodeRow | null> {
  // workspace-scope-ok: looked up by the hash of a secret only its holder knows (same as api_tokens)
  const rows = await sql`
    update extension_auth_codes set used_at = now()
    where code_hash = ${codeHash} and used_at is null and expires_at > now()
    returning workspace_id, user_id, code_challenge, redirect_uri, scopes, device_label
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    workspaceId: Number(r.workspace_id),
    userId: Number(r.user_id),
    codeChallenge: r.code_challenge as string,
    redirectUri: r.redirect_uri as string,
    scopes: r.scopes as string[],
    deviceLabel: (r.device_label as string | null) ?? null,
  };
}

export async function insertSession(input: {
  workspaceId: number;
  userId: number;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  deviceLabel: string | null;
  expiresAt: Date;
}): Promise<number> {
  const rows = await sql`
    insert into extension_sessions (workspace_id, user_id, token_hash, token_prefix, scopes, device_label, expires_at)
    values (${input.workspaceId}, ${input.userId}, ${input.tokenHash}, ${input.tokenPrefix}, ${input.scopes}::text[],
            ${input.deviceLabel}, ${input.expiresAt.toISOString()})
    returning id
  `;
  return Number(rows[0].id);
}

export type LiveSession = {
  id: number;
  workspaceId: number;
  workspaceName: string;
  userId: number;
  userName: string;
  userEmail: string;
  role: Role;
  scopes: string[];
  deviceLabel: string | null;
  lastUsedAt: string | null;
};

/**
 * Resolves a token to a session that is usable RIGHT NOW: not revoked, not expired, and the user is still an
 * active member of that workspace. The role comes from workspace_members, not from the token.
 */
export async function findLiveSession(tokenHash: string): Promise<LiveSession | null> {
  const rows = await sql`
    select s.id, s.workspace_id, s.user_id, s.scopes, s.device_label, s.last_used_at,
           m.role, u.name as user_name, u.email as user_email, w.name as workspace_name
    from extension_sessions s
    join workspace_members m on m.workspace_id = s.workspace_id and m.user_id = s.user_id and m.status = 'active'
    join users u on u.id = s.user_id
    join workspaces w on w.id = s.workspace_id
    where s.token_hash = ${tokenHash} and s.revoked_at is null and s.expires_at > now()
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    workspaceId: Number(r.workspace_id),
    workspaceName: r.workspace_name as string,
    userId: Number(r.user_id),
    userName: r.user_name as string,
    userEmail: r.user_email as string,
    role: r.role as Role,
    scopes: r.scopes as string[],
    deviceLabel: (r.device_label as string | null) ?? null,
    lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
  };
}

/** Slides the expiry forward. Only writes when the last touch is stale, so a busy popup isn't a write per request. */
export async function touchSession(workspaceId: number, sessionId: number, ttlDays: number): Promise<void> {
  await sql`
    update extension_sessions
    set last_used_at = now(), expires_at = now() + make_interval(days => ${ttlDays})
    where id = ${sessionId} and workspace_id = ${workspaceId}
      and (last_used_at is null or last_used_at < now() - interval '5 minutes')
  `;
}

export type SessionListItem = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  deviceLabel: string | null;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

/** Active (unrevoked, unexpired) sessions in a workspace; `onlyUserId` restricts to one person's own. */
export async function listActiveSessions(workspaceId: number, onlyUserId?: number): Promise<SessionListItem[]> {
  const rows = await sql.query(
    `select s.id, s.user_id, s.device_label, s.token_prefix, s.scopes, s.created_at, s.last_used_at, s.expires_at,
            u.name as user_name, u.email as user_email
     from extension_sessions s join users u on u.id = s.user_id
     where s.workspace_id = $1 and s.revoked_at is null and s.expires_at > now()
       and ($2::bigint is null or s.user_id = $2)
     order by coalesce(s.last_used_at, s.created_at) desc`,
    [workspaceId, onlyUserId ?? null],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    userName: r.user_name as string,
    userEmail: r.user_email as string,
    deviceLabel: (r.device_label as string | null) ?? null,
    tokenPrefix: r.token_prefix as string,
    scopes: r.scopes as string[],
    createdAt: String(r.created_at),
    lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    expiresAt: String(r.expires_at),
  }));
}

/** Revokes one session. `onlyUserId` (set for non-admins) limits it to the caller's own sessions. */
export async function revokeSessionRow(workspaceId: number, sessionId: number, revokedByUserId: number, onlyUserId?: number): Promise<boolean> {
  const rows = await sql.query(
    `update extension_sessions set revoked_at = now(), revoked_by_user_id = $3
     where id = $1 and workspace_id = $2 and revoked_at is null and ($4::bigint is null or user_id = $4)
     returning id`,
    [sessionId, workspaceId, revokedByUserId, onlyUserId ?? null],
  );
  return rows.length > 0;
}
