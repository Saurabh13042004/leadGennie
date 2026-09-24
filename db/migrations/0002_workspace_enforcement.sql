-- Phase 0 / WP0.2 — codify what scripts/migrate-workspaces.mjs used to do by hand.
--
-- The live database was brought to this state by that one-off script, so
-- 0001_baseline.sql (a verbatim copy of the old schema.sql) alone does NOT
-- reproduce production. This migration closes the gap: on an already-migrated
-- database every statement below is a no-op; on a clean database it produces
-- the same end state. If any row is still missing a workspace_id the
-- `set not null` statements fail and the whole migration rolls back — fix the
-- orphans, don't work around them.

-- 1. Backfill workspace_id from the owner's workspace (idempotent).
update leads t set workspace_id = wm.workspace_id
  from workspace_members wm join users u on u.id = wm.user_id
  where t.workspace_id is null and lower(u.email) = lower(t.owner_email) and wm.role = 'owner';

update segments t set workspace_id = wm.workspace_id
  from workspace_members wm join users u on u.id = wm.user_id
  where t.workspace_id is null and lower(u.email) = lower(t.owner_email) and wm.role = 'owner';

update campaigns t set workspace_id = wm.workspace_id
  from workspace_members wm join users u on u.id = wm.user_id
  where t.workspace_id is null and lower(u.email) = lower(t.owner_email) and wm.role = 'owner';

update crm_connections t set workspace_id = wm.workspace_id
  from workspace_members wm join users u on u.id = wm.user_id
  where t.workspace_id is null and lower(u.email) = lower(t.owner_email) and wm.role = 'owner';

update api_tokens t set workspace_id = wm.workspace_id
  from workspace_members wm join users u on u.id = wm.user_id
  where t.workspace_id is null and lower(u.email) = lower(t.owner_email) and wm.role = 'owner';

update campaign_sends cs set workspace_id = c.workspace_id
  from campaigns c
  where cs.workspace_id is null and cs.campaign_id = c.id;

-- 2. workspace_id is mandatory on every business table.
alter table leads alter column workspace_id set not null;
alter table segments alter column workspace_id set not null;
alter table campaigns alter column workspace_id set not null;
alter table campaign_sends alter column workspace_id set not null;
alter table api_tokens alter column workspace_id set not null;
alter table crm_connections alter column workspace_id set not null;

-- 3. api_tokens: one token per workspace (was one per user email).
alter table api_tokens drop constraint if exists api_tokens_owner_email_key;
create unique index if not exists api_tokens_workspace_id_idx on api_tokens (workspace_id);

-- 4. crm_connections: workspace-scoped uniqueness.
create unique index if not exists crm_connections_workspace_provider_portal_idx
  on crm_connections (workspace_id, provider, portal_id);
