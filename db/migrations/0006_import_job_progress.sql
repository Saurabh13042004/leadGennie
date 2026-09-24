-- Phase 1 / WP1.2 — chunked, resumable imports.
--
-- import_jobs already records the outcome of an import; it now also tracks
-- progress while the import is running. chunk_results holds each chunk's
-- outcome keyed by chunk index, which is what makes re-delivering a chunk a
-- no-op instead of double-counting it.

alter table import_jobs add column if not exists processed_rows int not null default 0;
alter table import_jobs add column if not exists blocked_count int not null default 0;
alter table import_jobs add column if not exists risky_count int not null default 0;
alter table import_jobs add column if not exists options jsonb not null default '{}';
alter table import_jobs add column if not exists chunk_results jsonb not null default '{}';
alter table import_jobs add column if not exists idempotency_key text;
alter table import_jobs add column if not exists finished_at timestamptz;
alter table import_jobs add column if not exists updated_at timestamptz not null default now();

-- A double-clicked "Import" (or a retried startImport) resolves to ONE job.
create unique index if not exists import_jobs_workspace_idempotency_idx
  on import_jobs (workspace_id, idempotency_key) where idempotency_key is not null;
