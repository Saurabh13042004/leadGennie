-- Phase 7 — browser-extension authentication.
--
-- Replaces "paste the workspace API token into the options page" with a real connect flow:
-- the extension opens LeadGennie in a browser window, the signed-in user approves, and the
-- extension exchanges a one-time code (PKCE) for its OWN revocable token. The old workspace
-- token (api_tokens) keeps working for existing installs.

-- One-time authorization codes: minted by the consent page, exchanged once by the extension.
-- Only a hash is stored; a code lives two minutes and works exactly once.
create table if not exists extension_auth_codes (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint not null references users (id) on delete cascade,
  code_hash text not null unique,
  -- PKCE: base64url(sha256(code_verifier)). The verifier never leaves the extension until the exchange.
  code_challenge text not null,
  redirect_uri text not null,
  scopes text[] not null,
  device_label text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists extension_auth_codes_workspace_idx on extension_auth_codes (workspace_id);
create index if not exists extension_auth_codes_expires_idx on extension_auth_codes (expires_at);

-- One row per connected browser. The token itself is never stored (SHA-256 only); role is NOT
-- stored either — it is re-read from workspace_members on every request, so demoting or removing
-- someone takes effect immediately.
create table if not exists extension_sessions (
  id bigserial primary key,
  workspace_id bigint not null references workspaces (id) on delete cascade,
  user_id bigint not null references users (id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Sliding: pushed forward on use, so an abandoned browser stops working on its own.
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by_user_id bigint references users (id) on delete set null
);
create index if not exists extension_sessions_workspace_idx on extension_sessions (workspace_id, created_at desc);
create index if not exists extension_sessions_user_idx on extension_sessions (user_id);

-- Fixed-window request counters (per token / per address). Not tenant data: the bucket key is a
-- hash of a session id or an IP, never a workspace-owned record.
create table if not exists api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);
create index if not exists api_rate_limits_window_idx on api_rate_limits (window_start);
