-- Phase 1 / WP1.5 (D-07) — sender positioning + ICP live on the workspace.
--
-- Expand step of expand → migrate → contract: users.pitch / users.company are
-- NOT dropped; they are dual-written by lib/actions/profile.ts and read as a
-- fallback until a later release removes them.

alter table workspaces add column if not exists positioning text;
alter table workspaces add column if not exists company_name text;
alter table workspaces add column if not exists icp jsonb;
alter table workspaces add column if not exists onboarding_dismissed_at timestamptz;

-- Seed from the workspace creator's existing profile (idempotent: only fills blanks).
update workspaces w
set positioning = coalesce(nullif(trim(w.positioning), ''), nullif(trim(u.pitch), '')),
    company_name = coalesce(nullif(trim(w.company_name), ''), nullif(trim(u.company), ''))
from users u
where u.id = w.created_by_user_id
  and (w.positioning is null or w.company_name is null);
