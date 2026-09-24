-- Phase 1 / WP1.1 — canonical companies + richer lead fields.
--
-- Additive only (expand step): leads.company (free text) stays and stays the
-- source for campaign placeholders; leads.company_id is the canonical link.
-- Every ADD COLUMN below is metadata-only on Postgres 11+ (constant defaults),
-- so it does not rewrite or long-lock the leads table.

create table if not exists companies (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  name text not null,
  -- Conservative normalized name used ONLY for matching (see lib/domain/companies/normalize.ts).
  name_key text not null check (name_key <> ''),
  domain text,
  linkedin_url text,
  industry text,
  employee_count int,
  location text,
  description text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One company per domain per workspace. Never merged across workspaces.
create unique index if not exists companies_workspace_domain_idx
  on companies (workspace_id, lower(domain)) where domain is not null;
-- Name-only companies (legacy free-text leads) are unique by normalized name;
-- a company that HAS a domain may share a name with another domain (surfaced
-- as a possible duplicate, never auto-merged).
create unique index if not exists companies_workspace_name_only_idx
  on companies (workspace_id, name_key) where domain is null;
create index if not exists companies_workspace_name_key_idx
  on companies (workspace_id, name_key);

alter table leads add column if not exists company_id bigint references companies (id) on delete set null;
alter table leads add column if not exists first_name text;
alter table leads add column if not exists last_name text;
alter table leads add column if not exists phone text;
alter table leads add column if not exists source_url text;
alter table leads add column if not exists email_status text not null default 'unverified';
alter table leads add column if not exists updated_at timestamptz not null default now();

alter table leads drop constraint if exists leads_email_status_check;
alter table leads add constraint leads_email_status_check
  check (email_status in ('unverified', 'valid', 'invalid', 'risky'));

create index if not exists leads_workspace_company_idx on leads (workspace_id, company_id);
create index if not exists leads_workspace_created_idx on leads (workspace_id, created_at desc, id desc);
create index if not exists leads_workspace_stage_idx on leads (workspace_id, stage);
create index if not exists leads_workspace_email_status_idx on leads (workspace_id, email_status);
create index if not exists leads_workspace_linkedin_idx
  on leads (workspace_id, lower(linkedin_url)) where linkedin_url is not null;
