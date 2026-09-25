-- OAuth mailboxes (Gmail / Google Workspace, Microsoft 365 / Outlook) next to the existing Resend-domain mailboxes.
--
-- Additive and backward compatible: every existing row is a `resend` mailbox on a verified domain and stays exactly that.
-- `status = 'active'` keeps meaning "connected and allowed to send" for every provider (the UI labels it "Connected"); the new
-- statuses only ever apply to OAuth mailboxes. Tokens are stored as AES-256-GCM ciphertext (lib/crypto.ts) and are read only by
-- lib/domain/mailboxes/credentials.ts — no query that feeds the UI selects these columns.

-- An OAuth mailbox has no sending domain of its own (its provider owns the DNS), so the domain link becomes optional…
alter table mailboxes alter column domain_id drop not null;

alter table mailboxes add column if not exists owner_user_id bigint references users (id) on delete set null;
alter table mailboxes add column if not exists display_name text;
-- The provider's stable id for the account (Google `sub`, Microsoft object id): survives the user renaming/aliasing the address.
alter table mailboxes add column if not exists provider_account_id text;
alter table mailboxes add column if not exists access_token_enc text;
alter table mailboxes add column if not exists refresh_token_enc text;
alter table mailboxes add column if not exists token_expires_at timestamptz;
-- Bumped on every token write: a refresh only lands if nobody else refreshed first (compare-and-swap; the HTTP driver has no row locks).
alter table mailboxes add column if not exists token_version int not null default 0;
alter table mailboxes add column if not exists scopes text[] not null default '{}';
alter table mailboxes add column if not exists last_synced_at timestamptz;
alter table mailboxes add column if not exists last_error text;
alter table mailboxes add column if not exists connected_at timestamptz;
alter table mailboxes add column if not exists disconnected_at timestamptz;
alter table mailboxes add column if not exists updated_at timestamptz not null default now();

update mailboxes set owner_user_id = created_by_user_id where owner_user_id is null;

-- …but a Resend mailbox still needs its domain.
alter table mailboxes drop constraint if exists mailboxes_provider_check;
alter table mailboxes add constraint mailboxes_provider_check check (provider in ('resend', 'gmail', 'microsoft'));
alter table mailboxes drop constraint if exists mailboxes_status_check;
alter table mailboxes add constraint mailboxes_status_check
  check (status in ('pending_approval', 'active', 'paused', 'reconnect_required', 'disconnected', 'error'));
alter table mailboxes drop constraint if exists mailboxes_domain_by_provider_check;
alter table mailboxes add constraint mailboxes_domain_by_provider_check check (provider <> 'resend' or domain_id is not null);

-- One connection per provider account per workspace: connecting the same Google account twice reconnects it.
create unique index if not exists mailboxes_provider_account_idx
  on mailboxes (workspace_id, provider, provider_account_id) where provider_account_id is not null;

-- messages: which provider thread/conversation the email belongs to (Gmail threadId, Graph conversationId), and the
-- write-ahead marker for providers that have no idempotency key (see lib/domain/sending/handler.ts).
alter table messages add column if not exists provider_thread_id text;
create index if not exists messages_thread_idx on messages (workspace_id, provider_thread_id) where provider_thread_id is not null;
-- Set just BEFORE a non-idempotent provider (Gmail, Microsoft) is called. If it is already set when a retry arrives, the
-- earlier attempt may have gone out and the provider cannot tell us — so the email is flagged for a person, never re-sent.
alter table messages add column if not exists dispatched_at timestamptz;
