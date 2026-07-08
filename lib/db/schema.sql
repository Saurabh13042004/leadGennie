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
