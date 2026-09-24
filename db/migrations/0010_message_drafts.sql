-- Phase 3 / WP3.3-3.4 — evidence-backed email drafts, their edit history, and workspace tone.
--
-- Written ONLY by lib/domain/personalization/drafts.ts. Every row is workspace-scoped. A draft is a proposal a
-- person reviews: nothing here sends anything. Regenerating never overwrites — the previous draft is kept
-- (is_current = false) so the audit trail and any approved copy survive.

alter table workspaces add column if not exists tone text not null default 'concise';
alter table workspaces drop constraint if exists workspaces_tone_check;
alter table workspaces add constraint workspaces_tone_check check (tone in ('concise', 'friendly', 'formal', 'direct'));

create table if not exists message_drafts (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  lead_id bigint not null references leads (id) on delete cascade,
  campaign_id bigint references campaigns (id) on delete set null,
  step_index int not null default 0,
  channel text not null default 'email' check (channel = 'email'),
  is_current boolean not null default true,
  status text not null check (status in ('draft', 'edited', 'approved', 'rejected', 'failed_validation')),
  subject text not null default '',
  body text not null default '',
  -- The model's own words, kept exactly as generated even after the user edits `subject`/`body`.
  original_subject text not null default '',
  original_body text not null default '',
  angle text not null default '',
  tone text not null,
  include_news boolean not null default false,
  used_evidence_ids bigint[] not null default '{}',
  -- [{ text, evidence_id }] — the phrases in the body that lean on evidence (drives the preview highlights).
  claims jsonb not null default '[]',
  -- [{ code, severity, message }] from the deterministic validators (latest run; edits re-run them).
  issues jsonb not null default '[]',
  attempts int not null default 1,
  confidence numeric(4, 3),
  prompt_version text not null,
  prompt_version_id bigint references prompt_versions (id) on delete set null,
  model text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  generation_id bigint references message_generations (id) on delete set null,
  research_id bigint references lead_research (id) on delete set null,
  agent_run_id bigint references agent_runs (id) on delete set null,
  created_by_user_id bigint references users (id) on delete set null,
  edited_by_user_id bigint references users (id) on delete set null,
  approved_by_user_id bigint references users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists message_drafts_current_idx
  on message_drafts (workspace_id, lead_id, step_index, coalesce(campaign_id, 0)) where is_current;
create index if not exists message_drafts_workspace_status_idx on message_drafts (workspace_id, status, updated_at desc);
create index if not exists message_drafts_lead_idx on message_drafts (workspace_id, lead_id, created_at desc);

create table if not exists message_draft_edits (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  draft_id bigint not null references message_drafts (id) on delete cascade,
  edited_by_user_id bigint references users (id) on delete set null,
  before_subject text not null,
  before_body text not null,
  after_subject text not null,
  after_body text not null,
  -- What the validators said about the edited text. A user owns their edits: this warns, it never blocks.
  issues jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists message_draft_edits_draft_idx on message_draft_edits (workspace_id, draft_id, created_at);
