-- Phase 2B / WP2B.1 — durable background jobs, usage metering, observable agent runs.
--
-- Additive only. `jobs` is the Postgres-backed queue (docs/02-architecture.md → Durable jobs, decision D-01):
-- a job is claimed with a single `FOR UPDATE SKIP LOCKED` statement and holds a time-boxed lease, so a
-- crashed worker's job is picked up again. `attempts` counts FAILURES (a poll-and-reschedule cycle is not a
-- failure), which is what lets a handler wait on an external system (the Intelligence Engine) across ticks.

create table if not exists agent_runs (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint references users (id) on delete set null,
  type text not null,
  input jsonb not null default '{}',
  plan jsonb,
  output jsonb not null default '{}',
  status text not null default 'running'
    check (status in ('planned', 'awaiting_approval', 'running', 'paused', 'completed', 'failed', 'canceled')),
  progress jsonb not null default '{}',
  error text,
  tokens_used int not null default 0,
  credits_used numeric(12, 4) not null default 0,
  parent_run_id bigint references agent_runs (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_workspace_idx on agent_runs (workspace_id, created_at desc);
create index if not exists agent_runs_parent_idx on agent_runs (parent_run_id);

-- One row per tool / engine step. The engine's `trace[]` is imported here so the run debug page shows
-- what happened inside the Python service too.
create table if not exists agent_run_steps (
  id bigserial primary key,
  run_id bigint not null references agent_runs (id) on delete cascade,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  seq int not null,
  agent text,
  tool text,
  input_summary text not null default '',
  output_summary text not null default '',
  status text not null default 'ok',
  duration_ms int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  credits numeric(12, 4) not null default 0,
  error text,
  started_at timestamptz not null default now()
);
create index if not exists agent_run_steps_run_idx on agent_run_steps (run_id, seq);

-- Append-only metering. Recorded by the app (single writer) from the engine's `usage[]` and from the app's
-- own LLM calls. Credits are enforced later (Phase 10); until then this is the cost record.
create table if not exists usage_records (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint references users (id) on delete set null,
  kind text not null check (kind in ('llm', 'search', 'fetch', 'provider', 'ai_generation')),
  provider text not null,
  model text,
  units numeric(14, 4) not null default 1,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_estimate numeric(12, 6) not null default 0,
  ref_type text,
  ref_id bigint,
  agent_run_id bigint references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists usage_records_workspace_idx on usage_records (workspace_id, created_at desc);

create table if not exists jobs (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint references users (id) on delete set null,
  type text not null,
  payload jsonb not null default '{}',
  -- Handler-owned scratch (e.g. the engine run id while waiting on it).
  state jsonb not null default '{}',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'dead', 'canceled')),
  idempotency_key text,
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_at timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  result jsonb,
  error text,
  agent_run_id bigint references agent_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
-- Re-enqueueing the same logical job is a no-op.
create unique index if not exists jobs_idempotency_idx
  on jobs (workspace_id, type, idempotency_key) where idempotency_key is not null;
create index if not exists jobs_claim_idx on jobs (status, run_at);
create index if not exists jobs_workspace_idx on jobs (workspace_id, created_at desc);
create index if not exists jobs_agent_run_idx on jobs (agent_run_id);
