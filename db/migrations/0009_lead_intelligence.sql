-- Phase 2B / WP2B.2 — research, signals, evidence and scores (docs/03-data-model.md).
--
-- Written ONLY by lib/intelligence/persist.ts from a validated Intelligence Engine result (single writer).
-- Every row is workspace-scoped. Re-research never edits history: the previous lead_research/signals rows are
-- flipped to is_current = false and new rows are inserted.

alter table leads add column if not exists icp_score int check (icp_score between 0 and 100);
alter table leads add column if not exists intent_score int check (intent_score between 0 and 100);
alter table leads add column if not exists scoring_version text;
alter table leads add column if not exists qualified boolean;
alter table leads add column if not exists research_status text not null default 'none';
alter table leads add column if not exists researched_at timestamptz;
alter table leads drop constraint if exists leads_research_status_check;
alter table leads add constraint leads_research_status_check
  check (research_status in ('none', 'queued', 'running', 'done', 'partial', 'failed'));
create index if not exists leads_workspace_icp_idx on leads (workspace_id, icp_score desc nulls last, id desc);
create index if not exists leads_workspace_research_idx on leads (workspace_id, research_status);

alter table companies add column if not exists researched_at timestamptz;

create table if not exists lead_research (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  lead_id bigint not null references leads (id) on delete cascade,
  company_id bigint references companies (id) on delete set null,
  is_current boolean not null default true,
  status text not null check (status in ('complete', 'partial', 'failed')),
  why_contact text not null default '',
  why_now text not null default '',
  why_person text not null default '',
  potential_problem text not null default '',
  recommended_angle text not null default '',
  insufficient_evidence boolean not null default false,
  icp_score int,
  icp_confidence numeric(4, 3),
  icp_breakdown jsonb not null default '[]',
  intent_breakdown jsonb not null default '[]',
  why_fit jsonb not null default '[]',
  scoring_inputs jsonb not null default '{}',
  scoring_version text,
  qualified boolean,
  evidence_ids bigint[] not null default '{}',
  unknowns jsonb not null default '[]',
  warnings jsonb not null default '[]',
  engine_run_id text,
  engine_contract_version text,
  agent_run_id bigint references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists lead_research_current_idx on lead_research (lead_id) where is_current;
create index if not exists lead_research_workspace_idx on lead_research (workspace_id, lead_id, created_at desc);

create table if not exists signals (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  lead_id bigint references leads (id) on delete cascade,
  company_id bigint references companies (id) on delete set null,
  research_id bigint references lead_research (id) on delete cascade,
  is_current boolean not null default true,
  type text not null check (type in ('FUNDING', 'HIRING', 'EXPANSION', 'PRODUCT_LAUNCH', 'LEADERSHIP_CHANGE', 'TECH_CHANGE', 'JOB_POSTING', 'NEWS')),
  title text not null,
  description text not null default '',
  detected_at date,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  -- Unverified signals are stored for transparency but NEVER feed scores, research narrative or generation.
  verified boolean not null,
  conflicts_with bigint[] not null default '{}',
  engine_signal_id text,
  created_at timestamptz not null default now(),
  check (lead_id is not null or company_id is not null)
);
create index if not exists signals_workspace_lead_idx on signals (workspace_id, lead_id, is_current);
create index if not exists signals_workspace_company_idx on signals (workspace_id, company_id, is_current);

create table if not exists evidence (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  lead_id bigint references leads (id) on delete cascade,
  company_id bigint references companies (id) on delete set null,
  signal_id bigint references signals (id) on delete cascade,
  research_id bigint references lead_research (id) on delete cascade,
  claim text not null,
  source_url text not null,
  source_title text,
  source_type text not null,
  snippet text not null,
  content_hash text not null,
  captured_at timestamptz not null,
  -- Denormalized from `verification` for indexing/filtering; the engine's verdict (method, confidence, notes) is kept whole.
  verified boolean not null,
  verification jsonb not null default '{}',
  engine_evidence_id text,
  engine_run_id text,
  created_at timestamptz not null default now(),
  check (lead_id is not null or company_id is not null)
);
create index if not exists evidence_workspace_lead_idx on evidence (workspace_id, lead_id);
create index if not exists evidence_workspace_company_idx on evidence (workspace_id, company_id);
create index if not exists evidence_signal_idx on evidence (signal_id);

-- Where each enriched value came from. A value entered by a user is never overwritten by source = 'engine'.
create table if not exists field_provenance (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'company')),
  entity_id bigint not null,
  field text not null,
  value text not null,
  source text not null check (source in ('user', 'import', 'extension', 'engine')),
  evidence_id bigint references evidence (id) on delete set null,
  confidence numeric(4, 3),
  set_by text not null check (set_by in ('user', 'job', 'agent')),
  created_at timestamptz not null default now()
);
create index if not exists field_provenance_entity_idx on field_provenance (workspace_id, entity_type, entity_id, field);

-- People the engine found at a researched company. Suggestions only: they become leads through the Phase 1
-- import service after a person approves (never automatically, and emails are never inferred).
create table if not exists prospect_candidates (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  company_id bigint references companies (id) on delete set null,
  source_lead_id bigint references leads (id) on delete set null,
  name text not null,
  title text,
  linkedin_url text,
  email text,
  relevance text not null default '',
  evidence_ids bigint[] not null default '{}',
  provider text not null default 'engine',
  status text not null default 'suggested' check (status in ('suggested', 'imported', 'dismissed')),
  agent_run_id bigint references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists prospect_candidates_workspace_idx on prospect_candidates (workspace_id, status);
create unique index if not exists prospect_candidates_unique_idx
  on prospect_candidates (workspace_id, coalesce(company_id, 0), lower(name), coalesce(lower(title), ''));
