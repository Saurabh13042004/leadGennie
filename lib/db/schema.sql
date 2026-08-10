create table if not exists leads (
  id bigserial primary key,
  owner_email text not null,
  full_name text not null,
  email text,
  company text,
  job_title text,
  linkedin_url text,
  stage text not null default 'new',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists leads_owner_email_idx on leads (owner_email);

create table if not exists segments (
  id bigserial primary key,
  owner_email text not null,
  name text not null,
  prompt text,
  criteria jsonb not null default '{}',
  lead_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists segments_owner_email_idx on segments (owner_email);

create table if not exists campaigns (
  id bigserial primary key,
  owner_email text not null,
  name text not null,
  status text not null default 'draft',
  audience_label text,
  audience_segment_id bigint references segments (id) on delete set null,
  channels text[] not null default '{}',
  from_email text,
  daily_email_limit int not null default 80,
  daily_dm_limit int not null default 25,
  total_leads int not null default 0,
  sent_count int not null default 0,
  replied_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_owner_email_idx on campaigns (owner_email);

create table if not exists campaign_steps (
  id bigserial primary key,
  campaign_id bigint not null references campaigns (id) on delete cascade,
  step_order int not null,
  channel text not null,
  wait_days int not null default 0,
  subject text,
  body text
);

create index if not exists campaign_steps_campaign_id_idx on campaign_steps (campaign_id);

create table if not exists demo_requests (
  id bigserial primary key,
  name text not null,
  email text not null,
  company text not null,
  company_size text,
  outbound_volume text,
  challenges text[] not null default '{}',
  crm_used text,
  created_at timestamptz not null default now()
);

create index if not exists demo_requests_email_idx on demo_requests (email);

-- INT-01: access_token/refresh_token hold ciphertext (lib/crypto.ts
-- encryptSecret/decryptSecret), never a plaintext OAuth token — see
-- app/api/integrations/hubspot/callback/route.ts (write) and
-- lib/actions/integrations.ts (read).
create table if not exists crm_connections (
  id bigserial primary key,
  owner_email text not null,
  provider text not null,
  label text,
  portal_id text,
  access_token text not null,
  refresh_token text not null,
  scope text,
  expires_at timestamptz not null,
  status text not null default 'connected',
  created_at timestamptz not null default now()
);

create index if not exists crm_connections_owner_email_idx on crm_connections (owner_email);
create unique index if not exists crm_connections_owner_provider_portal_idx
  on crm_connections (owner_email, provider, portal_id);

create table if not exists users (
  id bigserial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  company text,
  pitch text,
  created_at timestamptz not null default now()
);

alter table users add column if not exists pitch text;

create table if not exists campaign_sends (
  id bigserial primary key,
  campaign_id bigint not null references campaigns (id) on delete cascade,
  lead_id bigint not null references leads (id) on delete cascade,
  step_id bigint not null references campaign_steps (id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  subject text,
  body text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists campaign_sends_due_idx on campaign_sends (channel, status, scheduled_at);
create index if not exists campaign_sends_campaign_id_idx on campaign_sends (campaign_id);

create table if not exists api_tokens (
  id bigserial primary key,
  owner_email text not null unique,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Workspace isolation (AUD-01). Every business object below is scoped by
-- workspace_id, not owner_email. owner_email columns are kept for historical
-- display only and must not be used as an authorization boundary going forward.

create table if not exists workspaces (
  id bigserial primary key,
  name text not null,
  slug text not null unique,
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint references users (id) on delete cascade,
  invited_email text,
  role text not null default 'member',
  status text not null default 'active',
  invited_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint workspace_members_user_or_invite check (user_id is not null or invited_email is not null)
);

create unique index if not exists workspace_members_workspace_user_idx
  on workspace_members (workspace_id, user_id) where user_id is not null;
create unique index if not exists workspace_members_workspace_invited_email_idx
  on workspace_members (workspace_id, lower(invited_email)) where invited_email is not null;
create index if not exists workspace_members_user_id_idx on workspace_members (user_id);
create index if not exists workspace_members_invited_email_idx on workspace_members (lower(invited_email));

alter table leads add column if not exists workspace_id bigint references workspaces (id);
alter table segments add column if not exists workspace_id bigint references workspaces (id);
alter table campaigns add column if not exists workspace_id bigint references workspaces (id);
alter table campaign_sends add column if not exists workspace_id bigint references workspaces (id);
alter table crm_connections add column if not exists workspace_id bigint references workspaces (id);
alter table api_tokens add column if not exists workspace_id bigint references workspaces (id);

create index if not exists leads_workspace_id_idx on leads (workspace_id);
create index if not exists segments_workspace_id_idx on segments (workspace_id);
create index if not exists campaigns_workspace_id_idx on campaigns (workspace_id);
create index if not exists campaign_sends_workspace_id_idx on campaign_sends (workspace_id);
create index if not exists crm_connections_workspace_id_idx on crm_connections (workspace_id);

-- CRM-06: workspace-scoped Do Not Contact / suppression list. Checked at
-- campaign enrollment AND again immediately before send (never only once).
create table if not exists do_not_contact (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  email text not null,
  reason text,
  source text not null default 'manual',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists do_not_contact_workspace_email_idx
  on do_not_contact (workspace_id, lower(email));

-- CRM-03: idempotent lead identity + a persisted record of every import run
-- (created/updated/duplicate/skipped/failed), since imports must be safely
-- re-runnable and report exactly what happened.
create unique index if not exists leads_workspace_email_idx
  on leads (workspace_id, lower(email)) where email is not null;

create table if not exists import_jobs (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  source text not null default 'csv',
  file_name text,
  total_rows int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  duplicate_count int not null default 0,
  skipped_count int not null default 0,
  failed_count int not null default 0,
  error_report jsonb not null default '[]',
  status text not null default 'completed',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists import_jobs_workspace_id_idx on import_jobs (workspace_id);

alter table campaigns add column if not exists blocked_count int not null default 0;

-- TASK-02 / general audit: an append-only activity stream. Nothing updates or
-- deletes a row here — it is the record of who did what, when, to what.
create table if not exists activities (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  actor_user_id bigint references users (id) on delete set null,
  type text not null,
  entity_type text not null,
  entity_id bigint,
  summary text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists activities_workspace_id_idx on activities (workspace_id, created_at desc);
create index if not exists activities_entity_idx on activities (workspace_id, entity_type, entity_id);

-- CAM-01 / TASK-01: a generic workspace approval gate. Anything that needs
-- owner/admin sign-off before it takes effect creates one of these instead
-- of acting immediately.
create table if not exists approvals (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  entity_type text not null,
  entity_id bigint not null,
  title text not null,
  summary text,
  payload jsonb not null default '{}',
  requested_by_user_id bigint references users (id) on delete set null,
  decided_by_user_id bigint references users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists approvals_workspace_status_idx on approvals (workspace_id, status, created_at desc);
create index if not exists approvals_entity_idx on approvals (workspace_id, entity_type, entity_id);

-- DEAL-02: pipelines/stages are workspace-defined with stable internal keys
-- (stage_key), not hardcoded — so a stage rename never breaks references.
create table if not exists pipelines (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pipelines_workspace_id_idx on pipelines (workspace_id);

create table if not exists pipeline_stages (
  id bigserial primary key,
  pipeline_id bigint not null references pipelines (id) on delete cascade,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  stage_key text not null,
  name text not null,
  sort_order int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists pipeline_stages_pipeline_key_idx on pipeline_stages (pipeline_id, stage_key);
create index if not exists pipeline_stages_workspace_id_idx on pipeline_stages (workspace_id);

-- DEAL-01: deals are only ever created by an explicit authenticated user
-- action (see lib/actions/deals.ts) — AI may prefill the form, never submit it.
create table if not exists deals (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  pipeline_id bigint not null references pipelines (id) on delete restrict,
  stage_id bigint not null references pipeline_stages (id) on delete restrict,
  name text not null,
  value numeric(12, 2) not null default 0,
  probability int not null default 50,
  status text not null default 'open',
  lead_id bigint references leads (id) on delete set null,
  account_company text,
  owner_user_id bigint references users (id) on delete set null,
  expected_close_date date,
  source text not null default 'manual',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_workspace_id_idx on deals (workspace_id);
create index if not exists deals_pipeline_stage_idx on deals (pipeline_id, stage_id);

-- Tasks: manual, agent-generated, CRM-synced, meeting-followup, compliance-review.
-- Only 'manual' has a real producer today. The others are modeled so Flows,
-- Signals, and Inbox can start writing to this table without a schema change.
create table if not exists tasks (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  source text not null default 'manual',
  due_at timestamptz,
  owner_user_id bigint references users (id) on delete set null,
  related_entity_type text,
  related_entity_id bigint,
  completed_at timestamptz,
  completed_by_user_id bigint references users (id) on delete set null,
  outcome text,
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_workspace_status_idx on tasks (workspace_id, status);
create index if not exists tasks_workspace_owner_idx on tasks (workspace_id, owner_user_id);
create index if not exists tasks_due_at_idx on tasks (workspace_id, due_at);

-- CAM-03: the exact prompt/model/personalization input behind every
-- AI-generated message, for audit — not just the final text.
create table if not exists message_generations (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  campaign_id bigint references campaigns (id) on delete set null,
  step_index int,
  channel text not null,
  model text not null,
  prompt text not null,
  sender_company text,
  sender_pitch text,
  output_subject text,
  output_body text not null,
  generated_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists message_generations_workspace_id_idx on message_generations (workspace_id, created_at desc);
create index if not exists message_generations_campaign_id_idx on message_generations (campaign_id);

alter table campaigns add column if not exists approval_id bigint references approvals (id);

-- AI-01: prompts are a versioned family. A version becomes read-only once it
-- leaves 'draft' (enforced in lib/actions/prompts.ts, not just here) — the
-- only way to "edit" a published version is to clone it into a new draft.
create table if not exists prompts (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  name text not null,
  type text not null,
  channel text,
  archived boolean not null default false,
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists prompts_workspace_id_idx on prompts (workspace_id);

create table if not exists prompt_versions (
  id bigserial primary key,
  prompt_id bigint not null references prompts (id) on delete cascade,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  version_number int not null,
  status text not null default 'draft',
  template text not null default '',
  input_schema jsonb not null default '[]',
  output_schema jsonb not null default '[]',
  tone_rules text,
  prohibited_claims text,
  required_sources text,
  eval_notes text,
  model text not null,
  cloned_from_version_id bigint references prompt_versions (id) on delete set null,
  last_tested_at timestamptz,
  last_test_passed boolean,
  last_test_output jsonb,
  approval_id bigint references approvals (id) on delete set null,
  created_by_user_id bigint references users (id) on delete set null,
  approved_by_user_id bigint references users (id) on delete set null,
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists prompt_versions_prompt_version_idx on prompt_versions (prompt_id, version_number);
create index if not exists prompt_versions_workspace_id_idx on prompt_versions (workspace_id);
create index if not exists prompt_versions_prompt_id_idx on prompt_versions (prompt_id);

-- Campaign message generation now tries a workspace's published prompt first
-- (see lib/actions/ai.ts) — this records which one, if any, produced a given
-- message, so the audit trail shows library-authored vs the built-in default.
alter table message_generations add column if not exists prompt_version_id bigint references prompt_versions (id) on delete set null;

-- DEL-01/02: real sending domains, backed by Resend's actual Domains API
-- (not a hand-rolled DNS check) — records holds the exact DNS entries Resend
-- told us to add, plus their live per-record verification status.
create table if not exists domains (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  resend_domain_id text not null unique,
  name text not null,
  status text not null default 'not_started',
  region text,
  records jsonb not null default '[]',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_checked_at timestamptz
);

create index if not exists domains_workspace_id_idx on domains (workspace_id);
create unique index if not exists domains_workspace_name_idx on domains (workspace_id, lower(name));

-- DEL-02: adding a mailbox or raising its daily limit always goes through the
-- approvals engine — status starts at 'pending_approval', never 'active'.
create table if not exists mailboxes (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  domain_id bigint not null references domains (id) on delete restrict,
  email text not null,
  provider text not null default 'resend',
  status text not null default 'pending_approval',
  daily_limit int not null default 50,
  approval_id bigint references approvals (id) on delete set null,
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists mailboxes_workspace_email_idx on mailboxes (workspace_id, lower(email));
create index if not exists mailboxes_workspace_id_idx on mailboxes (workspace_id);
create index if not exists mailboxes_domain_id_idx on mailboxes (domain_id);

-- DEL-01: a campaign pins a specific verified mailbox rather than a free-typed
-- address; provider_message_id is Resend's id for a sent email, used to
-- correlate inbound bounce/complaint webhooks (DEL-03) back to the exact send.
alter table campaigns add column if not exists mailbox_id bigint references mailboxes (id) on delete set null;
alter table campaign_sends add column if not exists provider_message_id text;
create index if not exists campaign_sends_provider_message_id_idx on campaign_sends (provider_message_id);

-- Fix-up: mailboxes.domain_id was briefly created with ON DELETE CASCADE —
-- removing a domain must never silently delete its mailboxes.
alter table mailboxes drop constraint if exists mailboxes_domain_id_fkey;
alter table mailboxes add constraint mailboxes_domain_id_fkey foreign key (domain_id) references domains (id) on delete restrict;

-- INB-01/FORM-01: a form definition and its raw submissions. Every submission
-- is stored verbatim (payload, exact consent text/version, IP, UTM) before any
-- processing — spam-check, dedupe, and CRM proposal creation all happen after.
create table if not exists forms (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  name text not null,
  embed_key text not null unique,
  fields jsonb not null default '[]',
  consent_text text not null,
  consent_version text not null default '1',
  status text not null default 'active',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists forms_workspace_id_idx on forms (workspace_id);

create table if not exists form_submissions (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  form_id bigint not null references forms (id) on delete cascade,
  payload jsonb not null default '{}',
  consent_given boolean not null default false,
  consent_text text,
  consent_version text,
  ip_address text,
  user_agent text,
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  status text not null default 'pending',
  dedupe_key text,
  matched_lead_id bigint references leads (id) on delete set null,
  approval_id bigint references approvals (id) on delete set null,
  owner_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_workspace_id_idx on form_submissions (workspace_id, created_at desc);
create index if not exists form_submissions_dedupe_idx on form_submissions (form_id, dedupe_key);

-- Agentic Flows: a saved, reusable sequence template — decoupled from any one
-- campaign, unlike campaign_steps (which are always owned by exactly one
-- campaign and thrown away with it). `canvas` stores the visual builder's
-- node/edge layout verbatim (positions etc.) so re-opening a workflow renders
-- exactly as it was left; `workflow_steps` below is the *derived*, linear,
-- ordered execution list computed from that graph at save time — campaigns
-- read from workflow_steps, never from canvas directly.
create table if not exists workflows (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  name text not null,
  source_type text not null default 'all_leads', -- 'segment' | 'all_leads'
  source_segment_id bigint references segments (id) on delete set null,
  canvas jsonb not null default '{}',
  created_by_user_id bigint references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_workspace_id_idx on workflows (workspace_id);

create table if not exists workflow_steps (
  id bigserial primary key,
  workflow_id bigint not null references workflows (id) on delete cascade,
  step_order int not null,
  channel text not null,
  wait_days int not null default 0,
  subject text,
  body text not null default ''
);

create index if not exists workflow_steps_workflow_id_idx on workflow_steps (workflow_id);

-- Traceability only, not live linkage — a campaign created from a workflow
-- gets its own snapshotted campaign_steps copy (see lib/actions/campaigns.ts),
-- so editing the workflow template later never retroactively changes a
-- campaign that already launched from it.
alter table campaigns add column if not exists workflow_id bigint references workflows (id) on delete set null;
