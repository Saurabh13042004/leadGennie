-- Phase 5 — email execution engine (docs/phases/phase-05-email-engine.md).
--
-- `messages` is the durable record of every outbound email attempt and `message_events` the append-only log of what the
-- provider told us afterwards. Both are written only by lib/domain/sending/*. Additive: nothing existing is rewritten
-- (sent legacy sends are backfilled as messages so counts and webhook correlation are unified).

create table if not exists messages (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  campaign_id bigint references campaigns (id) on delete set null,
  campaign_lead_id bigint references campaign_leads (id) on delete set null,
  -- One message per scheduled send: the row is INSERTED BEFORE the provider is called, so a crash can never lose track of
  -- an email that may have gone out (see lib/domain/sending/handler.ts — at-most-once).
  campaign_send_id bigint references campaign_sends (id) on delete set null,
  lead_id bigint references leads (id) on delete set null,
  mailbox_id bigint references mailboxes (id) on delete set null,
  direction text not null default 'out' check (direction in ('out', 'in')),
  channel text not null default 'email',
  subject text not null default '',
  -- The exact text handed to the provider (footer included). A retry re-sends THIS, never a re-render.
  body text not null default '',
  headers jsonb not null default '{}',
  from_email text not null default '',
  to_email text not null default '',
  to_domain text not null default '',
  provider text not null default 'resend',
  provider_message_id text,
  -- Sent to the provider as the idempotency key: replaying the same request returns the original result instead of a second email.
  idempotency_key text not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'canceled')),
  error text,
  error_class text,
  attempts int not null default 0,
  soft_bounce_count int not null default 0,
  -- When the row was claimed = when the send was counted against limits and spacing.
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists messages_send_idx on messages (campaign_send_id) where campaign_send_id is not null;
create unique index if not exists messages_provider_idx on messages (provider, provider_message_id) where provider_message_id is not null;
create index if not exists messages_campaign_status_idx on messages (workspace_id, campaign_id, status);
create index if not exists messages_mailbox_claim_idx on messages (mailbox_id, claimed_at);
create index if not exists messages_domain_claim_idx on messages (workspace_id, to_domain, claimed_at);
create index if not exists messages_workspace_claim_idx on messages (workspace_id, claimed_at);

create table if not exists message_events (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  message_id bigint references messages (id) on delete cascade,
  type text not null,
  provider text not null default 'resend',
  -- The provider's own delivery id: the same webhook delivered twice is recorded once.
  provider_event_id text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create unique index if not exists message_events_provider_event_idx on message_events (provider, provider_event_id);
create index if not exists message_events_message_idx on message_events (workspace_id, message_id, occurred_at);

-- Sender identity for the compliance footer (CAN-SPAM/GDPR): who is sending and a postal address. Launch is blocked without it.
alter table workspaces add column if not exists sender_name text;
alter table workspaces add column if not exists sender_address text;
-- Optional workspace-wide ceiling on emails per day across all mailboxes (null = mailbox limits only).
alter table workspaces add column if not exists daily_send_cap int check (daily_send_cap is null or daily_send_cap > 0);

-- Why a campaign was paused by the system (bad domain, invalid API key, provider outage). Cleared on resume.
alter table campaigns add column if not exists paused_reason text;

-- The scheduler asks "does this send already have a live job?" — keep that lookup indexed.
create index if not exists jobs_send_payload_idx on jobs ((payload ->> 'campaignSendId')) where type = 'campaign_send';

-- Sends that already went out (legacy dispatcher) become messages, so campaign counts come from one place and their
-- provider ids correlate with delivery webhooks.
insert into messages (workspace_id, campaign_id, campaign_send_id, lead_id, mailbox_id, direction, channel, subject, body,
                      from_email, to_email, to_domain, provider, provider_message_id, idempotency_key, status, attempts, claimed_at, sent_at)
select cs.workspace_id, cs.campaign_id, cs.id, cs.lead_id, c.mailbox_id, 'out', 'email', coalesce(cs.subject, ''), cs.body,
       coalesce(c.from_email, ''), lower(l.email), split_part(lower(l.email), '@', 2), 'resend', cs.provider_message_id,
       'legacy:' || cs.id, 'sent', 1, coalesce(cs.sent_at, cs.created_at), cs.sent_at
from campaign_sends cs
join campaigns c on c.id = cs.campaign_id
join leads l on l.id = cs.lead_id
where cs.status = 'sent' and cs.channel = 'email' and l.email is not null
on conflict do nothing;
