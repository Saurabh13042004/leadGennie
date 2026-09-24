import { sql } from "@/lib/db/client";
import type { Icp } from "@/lib/domain/workspace/icp";
import type { OnboardingFacts } from "@/lib/domain/workspace/onboarding";

/** Workspace-level positioning + ICP (D-07). The users.pitch/company columns are the legacy fallback. */

export type WorkspaceProfile = {
  positioning: string | null;
  companyName: string | null;
  icp: unknown;
};

export async function getWorkspaceProfile(workspaceId: number): Promise<WorkspaceProfile> {
  const rows = await sql`select positioning, company_name, icp from workspaces where id = ${workspaceId}`;
  const r = rows[0];
  return {
    positioning: (r?.positioning as string | null) ?? null,
    companyName: (r?.company_name as string | null) ?? null,
    icp: r?.icp ?? null,
  };
}

export async function updateWorkspaceProfile(
  workspaceId: number,
  patch: { positioning?: string | null; companyName?: string | null; icp?: Icp | null },
): Promise<void> {
  // COALESCE-with-flag pattern: only the provided keys change.
  await sql.query(
    `update workspaces set
       positioning = case when $2::boolean then $3 else positioning end,
       company_name = case when $4::boolean then $5 else company_name end,
       icp = case when $6::boolean then $7::jsonb else icp end
     where id = $1`,
    [
      workspaceId,
      patch.positioning !== undefined, patch.positioning ?? null,
      patch.companyName !== undefined, patch.companyName ?? null,
      patch.icp !== undefined, patch.icp === undefined || patch.icp === null ? null : JSON.stringify(patch.icp),
    ],
  );
}

/**
 * Sender context for message generation. Reads the workspace first and falls
 * back to the user's legacy profile, so a workspace that predates D-07 keeps working.
 */
export async function getSenderContext(
  workspaceId: number,
  userId: number,
): Promise<{ company: string | null; pitch: string | null }> {
  const rows = await sql`
    select nullif(btrim(w.company_name), '') as company_name, nullif(btrim(w.positioning), '') as positioning,
           nullif(btrim(u.company), '') as user_company, nullif(btrim(u.pitch), '') as user_pitch
    from workspaces w left join users u on u.id = ${userId}
    where w.id = ${workspaceId}
  `;
  const r = rows[0];
  return {
    company: ((r?.company_name ?? r?.user_company) as string | null) ?? null,
    pitch: ((r?.positioning ?? r?.user_pitch) as string | null) ?? null,
  };
}

export async function setOnboardingDismissed(workspaceId: number, dismissed: boolean): Promise<void> {
  await sql`
    update workspaces set onboarding_dismissed_at = ${dismissed ? new Date().toISOString() : null}
    where id = ${workspaceId}
  `;
}

export async function getOnboardingFacts(workspaceId: number): Promise<OnboardingFacts> {
  const rows = await sql`
    select w.positioning, w.icp, w.onboarding_dismissed_at,
      exists (
        select 1 from mailboxes m join domains d on d.id = m.domain_id
        where m.workspace_id = w.id and m.status = 'active' and d.status = 'verified'
      ) as has_mailbox,
      exists (select 1 from leads l where l.workspace_id = w.id) as has_leads
    from workspaces w where w.id = ${workspaceId}
  `;
  const r = rows[0];
  return {
    positioning: (r?.positioning as string | null) ?? null,
    icp: r?.icp ?? null,
    hasActiveMailbox: r?.has_mailbox === true,
    hasLeads: r?.has_leads === true,
    dismissedAt: r?.onboarding_dismissed_at ? String(r.onboarding_dismissed_at) : null,
  };
}
