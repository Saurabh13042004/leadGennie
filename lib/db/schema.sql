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
