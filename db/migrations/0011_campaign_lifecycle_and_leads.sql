-- Phase 4 / WP4.1 — campaign lifecycle, per-lead state, builder columns (docs/phases/phase-04-campaign-builder.md).
--
-- Two send models coexist until Phase 5 replaces the compat sender:
--   send_model = 'legacy' : campaigns created before this migration. Approval pre-materialised campaign_sends rows
--                           (lib/actions/approvals.ts); they keep dispatching exactly as before. Existing rows default here.
--   send_model = 'leads'  : campaigns made with the builder. campaign_leads is the per-lead source of truth; the same
--                           dispatcher still performs the send from campaign_sends rows written at launch (compat).
-- Nothing here rewrites or deletes an existing row.

alter table campaigns add column if not exists send_model text not null default 'legacy';
alter table campaigns drop constraint if exists campaigns_send_model_check;
alter table campaigns add constraint campaigns_send_model_check check (send_model in ('legacy', 'leads'));

-- Status machine: draft → pending_approval → ready → running ⇄ paused → completed | failed, plus canceled / rejected.
-- 'pending_approval', 'running', 'paused' and 'rejected' are the legacy values and stay valid.
alter table campaigns drop constraint if exists campaigns_status_check;
alter table campaigns add constraint campaigns_status_check
  check (status in ('draft', 'pending_approval', 'ready', 'running', 'paused', 'completed', 'failed', 'canceled', 'rejected'));

alter table campaigns add column if not exists total_limit int check (total_limit is null or total_limit > 0);
alter table campaigns add column if not exists audience_definition jsonb;
alter table campaigns add column if not exists send_window jsonb;
alter table campaigns add column if not exists tone text;
-- Explicit opt-in: leads without an approved personalised draft get the step's template instead of blocking launch.
alter table campaigns add column if not exists allow_template_fallback boolean not null default false;
alter table campaigns add column if not exists created_by_user_id bigint references users (id) on delete set null;
alter table campaigns add column if not exists approved_at timestamptz;
alter table campaigns add column if not exists started_at timestamptz;
alter table campaigns add column if not exists paused_at timestamptz;
alter table campaigns add column if not exists completed_at timestamptz;
alter table campaigns add column if not exists updated_at timestamptz not null default now();
create index if not exists campaigns_workspace_status_idx on campaigns (workspace_id, status, created_at desc);

-- 'personalized' steps use each lead's approved Phase 3 draft (template = fallback); 'template' steps use the template.
alter table campaign_steps add column if not exists mode text not null default 'template';
alter table campaign_steps drop constraint if exists campaign_steps_mode_check;
alter table campaign_steps add constraint campaign_steps_mode_check check (mode in ('template', 'personalized'));
alter table campaign_steps add column if not exists updated_at timestamptz not null default now();
create unique index if not exists campaign_steps_campaign_order_idx on campaign_steps (campaign_id, step_order);

create table if not exists campaign_leads (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  campaign_id bigint not null references campaigns (id) on delete cascade,
  lead_id bigint not null references leads (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'replied', 'completed', 'stopped', 'bounced', 'unsubscribed', 'blocked', 'failed')),
  -- 0 = nothing sent yet; n = step n was the last one sent.
  current_step int not null default 0,
  next_action_at timestamptz,
  -- Why a lead is blocked/stopped ("do_not_contact", "cooldown", "campaign_canceled", …). Never silently dropped.
  stop_reason text,
  entered_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_id, lead_id)
);
create index if not exists campaign_leads_campaign_status_idx on campaign_leads (workspace_id, campaign_id, status);
create index if not exists campaign_leads_due_idx on campaign_leads (status, next_action_at);
create index if not exists campaign_leads_lead_idx on campaign_leads (workspace_id, lead_id, status);

-- The compat sender still sends from campaign_sends. These two columns tie a send to its lead-state row (idempotency:
-- one send per (campaign_lead, step)) and to the approved draft it was rendered from (audit).
alter table campaign_sends add column if not exists campaign_lead_id bigint references campaign_leads (id) on delete set null;
alter table campaign_sends add column if not exists message_draft_id bigint references message_drafts (id) on delete set null;
create unique index if not exists campaign_sends_lead_step_idx on campaign_sends (campaign_lead_id, step_id) where campaign_lead_id is not null;
create index if not exists campaign_sends_campaign_lead_idx on campaign_sends (campaign_lead_id) where campaign_lead_id is not null;
