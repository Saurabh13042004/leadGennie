-- Engine-owned schema. Public-web data and run bookkeeping ONLY — no workspace identifiers, no product data.
create schema if not exists intel;

create table if not exists intel.runs (
  run_id text primary key,
  idempotency_key text not null unique,
  task text not null,
  status text not null default 'queued',
  progress jsonb not null default '{"stage":"queued","pct":0}',
  request jsonb not null,
  input_hash text not null,
  result jsonb,
  error jsonb,
  trace jsonb not null default '[]',
  usage jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists intel_runs_status_idx on intel.runs (status);
create index if not exists intel_runs_finished_idx on intel.runs (finished_at);

create table if not exists intel.source_cache (
  url text primary key,
  doc jsonb not null,
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists intel_source_cache_expires_idx on intel.source_cache (expires_at);

-- Shared per-host politeness limiter so scaling replicas does not multiply crawl rate.
create table if not exists intel.host_limits (
  host text primary key,
  next_allowed_at timestamptz not null default now()
);
