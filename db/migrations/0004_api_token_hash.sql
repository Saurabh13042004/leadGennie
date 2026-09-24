-- Phase 0 / WP0.4 — API tokens are stored as a SHA-256 hash, never in clear.
--
-- Tokens are 192-bit random values, so an unsalted SHA-256 is sufficient (this
-- is a lookup key, not a password). Existing tokens are hashed in place using
-- Postgres' built-in sha256(), so any extension install that already holds
-- the plaintext keeps working with no re-issue; the plaintext is then erased
-- from the table. Only a short prefix is kept, for display.
alter table api_tokens add column if not exists token_hash text;
alter table api_tokens add column if not exists token_prefix text;

update api_tokens
  set token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
      token_prefix = left(token, 8)
  where token_hash is null and token is not null;

alter table api_tokens alter column token drop not null;
update api_tokens set token = null where token_hash is not null;

create unique index if not exists api_tokens_token_hash_idx on api_tokens (token_hash);

-- Every pre-existing row had a plaintext token, so every row is now hashed.
alter table api_tokens alter column token_hash set not null;
