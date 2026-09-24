-- Phase 0 / WP0.4 — stop treating owner_email as an identity.
--
-- workspace_id is the only authorization boundary. owner_email stays as
-- historical data (expand → migrate → contract: this is the "stop requiring
-- it" step; the column is dropped in a later release once nothing reads it).
alter table leads alter column owner_email drop not null;
alter table segments alter column owner_email drop not null;
alter table campaigns alter column owner_email drop not null;
alter table crm_connections alter column owner_email drop not null;
alter table api_tokens alter column owner_email drop not null;

-- The legacy uniqueness keyed on owner_email is meaningless once new rows
-- carry a null owner_email; the workspace-scoped unique index from 0002 is
-- the real constraint.
drop index if exists crm_connections_owner_provider_portal_idx;

-- Demo/test workspaces are explicitly flagged so they can never be confused
-- with (or counted as) real customer data.
alter table workspaces add column if not exists is_demo boolean not null default false;
