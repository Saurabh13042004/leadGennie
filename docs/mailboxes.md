# Mailboxes — OAuth Gmail / Microsoft 365 alongside Resend

Resolves **D-04** (owner request, 2026-09-26): the primary way to send is *connect the mailbox you already use* — sign in with Google or Microsoft — instead of *add a domain → SPF/DKIM → add a mailbox*. Resend + verified domains stays, as an advanced provider.

> Connect your existing work mailbox. LeadGennie handles the outbound.

Migration: [`db/migrations/0014_oauth_mailboxes.sql`](../db/migrations/0014_oauth_mailboxes.sql). Code: `lib/domain/mailboxes/*`, `lib/email/*`, `app/api/mailboxes/**`, `components/mailboxes/*`.

---

## 1. What was there before (audit)

| Area | Before |
|---|---|
| Send port | `MailProvider` (`lib/email/provider.ts`): `send`, `capabilities`, `isConfigured`. **One process-wide singleton** (`getMailProvider()`), Resend. |
| Send pipeline | `campaign_send` job (`lib/domain/sending/*`): guards → suppression → pure `SendGate` → **claim** (insert `messages` row before the provider call, caps re-verified under a per-mailbox advisory lock) → `provider.send(idempotencyKey)` → one-transaction finalize. At-most-once relied on **Resend replaying an idempotency key**. |
| Mailbox model | `mailboxes(domain_id NOT NULL → domains, email, provider default 'resend', status pending_approval\|active\|paused, daily_limit, approval_id)`. Adding a mailbox = approval request. Every mailbox needed a Resend domain. |
| Provider assumptions in the pipeline | `claimMessage` hard-coded `'resend'`; four SQL sites `join domains`; readiness/handler required "verified domain"; `sendTestEmail` used the singleton. |
| Credentials | `lib/crypto.ts` AES-256-GCM (HubSpot tokens). Extension auth (its own PKCE flow). No mailbox OAuth. |
| Inbox / reply sync | None (Phase 6). `messages.direction 'in'` reserved. |
| Limits / DNC / unsubscribe | Mailbox `daily_limit` + warm-up ramp, campaign/workspace caps, per-domain throttle, spacing jitter; DNC/unsub/bounce/complaint checked before **every** send; RFC 8058 headers + footer. **All provider-independent — reused as-is.** |
| UI | `/dashboard/deliverability`: domains table (DNS records) first, mailboxes second. |

## 2. Architecture

```
 Campaign / sequence / Inbox / agents
              │   (never names a provider)
              ▼
   campaign_send job ──► resolveMailboxProvider(mailbox.provider, ref)      lib/domain/mailboxes/registry.ts
              │                       │
              │        ┌──────────────┼───────────────────┐
              ▼        ▼              ▼                   ▼
        SendGate   GmailMailbox   MicrosoftMailbox   ResendProvider          lib/email/*
        + claim    Provider       Provider           (unchanged behaviour)
                       │              │
                       ▼              ▼
                 MailboxTokenSource ──► OAuthProviderClient (Google | Microsoft)
                 (refresh, CAS,          lib/domain/mailboxes/token-source.ts, oauth/*
                  encrypted at rest)
```

* **`MailProvider`** (send) → **`MailboxProvider`** adds `getProfile()` and optional `listMessages()` / `getThread()`. Capabilities are flags, not names: `idempotencyKey`, `oneClickUnsubscribeHeaders`, `threading`, `inboxSync`. Callers ask the flag.
* **Registry** (`registerMailboxProvider`) — a new provider is one entry in `lib/domain/mailboxes/register.ts`. Unknown key fails closed. `tests/unit/mailbox-boundaries.test.ts` fails the build if campaign/sending/agent code compares a provider name.
* **Adapters** own everything provider-specific: MIME, endpoints, error codes. `lib/email/gmail-provider.ts`, `microsoft-provider.ts`, `resend-provider.ts`; message normalisers `gmail-messages.ts` / `graph-messages.ts`.
* **Token source** gives an adapter a valid bearer token: refresh when about to expire, persist the result **compare-and-swap on `token_version`** (HTTP driver = no row locks; Microsoft rotates refresh tokens), and on a dead grant flip the mailbox to `reconnect_required`.
* **`MailboxService`** (`service.ts`): `providerForMailbox`, `sendTestEmail`, `disconnectMailbox`. Campaign sends do **not** go through a second sender: the `campaign_send` job already does workspace check → status check → DNC/unsub → limits → claim → provider → record, and resolves its provider through the same registry.

### Why the send pipeline changed (no idempotency key on Gmail/Graph)

Resend deduplicates a replayed idempotency key, which is what made "retry after a crash" safe. **Gmail and Graph don't.** So for providers with `capabilities.idempotencyKey === false`:

1. A write-ahead marker `messages.dispatched_at` is set **just before** the provider call (`UPDATE … WHERE dispatched_at IS NULL`; only one caller can flip it).
2. Any retry that finds it already set can't tell whether the first attempt went out → the email becomes `failed / unknown_outcome` for a person (retry or skip in *Send issues*). **Never re-sent automatically.**
3. The marker is cleared only when the provider's answer proves nothing was sent (429, auth, 4xx). Adapters uphold the contract: every error class except `unknown_outcome` means "not sent". A connection lost mid-send, or a 5xx, is `unknown_outcome`; a DNS/refused connection proves the request never left and is `retryable`.

Same philosophy as Phase 5: *a missed email over a duplicate.*

## 3. Data model (migration 0014, additive)

`mailboxes` gains: `owner_user_id`, `display_name`, `provider_account_id` (Google `sub` / Microsoft object id; unique per workspace+provider), `access_token_enc`, `refresh_token_enc` (AES-256-GCM ciphertext), `token_expires_at`, `token_version`, `scopes text[]`, `last_synced_at`, `last_error`, `connected_at`, `disconnected_at`, `updated_at`. `domain_id` becomes nullable (a `resend` mailbox still requires one — `CHECK`). `provider` ∈ `resend|gmail|microsoft`; `status` gains `reconnect_required|disconnected|error`.
`messages` gains `provider_thread_id` and `dispatched_at`.

Deliberate deviations from the brief's field list:
* **`sentToday` is not a column.** It is counted from `messages` (the rows the send gate already counts under its advisory lock) — a second counter would drift. `listMailboxes` now counts **per mailbox** (it previously showed the workspace's total on every row).
* **`active` is the stored value for `CONNECTED`.** It predates OAuth and every send path checks it; the UI says "Connected". No live data is rewritten.
* No existing row changes meaning: all current mailboxes stay `resend` on their verified domain.

### Status machine (`lib/domain/mailboxes/types.ts`, tested exhaustively)

```
pending_approval → active
active   → paused | reconnect_required | disconnected | error
paused   → active | reconnect_required | disconnected
error    → active | paused | reconnect_required | disconnected
reconnect_required → active (reconnect) | disconnected
disconnected → active (only by connecting again)
```
Every change is a conditional `UPDATE … WHERE status = ANY(allowed)`, so racing writers can't both win, plus an audit entry.

## 4. Connecting a mailbox

```
Settings → Mailboxes → Connect Google
  GET /api/mailboxes/google/connect          admin+ · builds consent URL · sets sealed httpOnly cookie
  → accounts.google.com  (PKCE S256, offline, prompt=select_account consent)
  GET /api/mailboxes/google/callback         admin+ · validates · exchanges code · learns identity · saves
  → /dashboard/deliverability?mailbox_connected=google
```
Reconnect = the same route with `?mailboxId=`; it must be the **same account** (`provider_account_id` and email) or it is refused.

Security properties (each has a test):
* **CSRF / ownership:** `state` is a random nonce; the flow lives in an **AES-256-GCM-sealed** cookie (`lg_mailbox_oauth`, httpOnly, SameSite=Lax, 10 min) binding nonce + provider + workspace + user + PKCE verifier. The callback must present the matching cookie *and* the same signed-in user/workspace. Forged, replayed, expired, cross-user, cross-workspace and cross-provider callbacks are refused before any provider call.
* **Granted scopes are verified** (granular consent lets users untick "send"): missing `gmail.send` / `Mail.Send` ⇒ refused.
* **Identity comes from the provider** (`getProfile()`); the address must be verified (Google `email_verified`; Microsoft `mail` provisioned).
* Tokens are encrypted before they reach a column; read only by `repository.loadSecrets` → `token-source.ts`; never in UI queries, actions' return values, URLs, activity rows or logs (`lib/log.ts` also redacts by key name). `mailbox-boundaries.test.ts` enforces which modules may touch the credential columns.
* Failures redirect with a **fixed code**; the page maps codes to sentences (`oauth/messages.ts`). Provider error text never reaches the browser.
* Role: **owner/admin** connect, pause, resume, disconnect (matches domains/HubSpot). Any non-viewer member can send *themselves* a test email.

### Scopes (least privilege — `lib/domain/mailboxes/scopes.ts`)

| | Google | Microsoft Graph (delegated) |
|---|---|---|
| Identity | `openid email profile` | `openid email profile offline_access User.Read` |
| **Send (requested today)** | `gmail.send` | `Mail.Send` |
| Inbox (defined, **not requested**) | `gmail.readonly` | `Mail.Read` |

`gmail.send` is a Google *sensitive* scope (app verification); `gmail.readonly` is *restricted* (security assessment) — that is why reading mail is opt-in per connection (`?inbox=1`) and the Inbox phase, not bundled with sending. `capabilities.inboxSync` is true only when the connection actually holds the read scope; otherwise `listMessages`/`getThread` fail with an `auth` error telling the user to reconnect.

## 5. Sending, limits, failures

* Provider is resolved **per mailbox**; `messages.provider` records it.
* Daily limit / warm-up ramp / campaign & workspace caps / domain throttle / spacing: unchanged, provider-independent, atomic (advisory lock + caps re-verified inside the insert). New OAuth mailboxes start at **50/day**; raising it still needs approval (`mailbox_limit_change`). Nothing hard-codes a provider's own limits — those still apply on top.
* Suppression (DNC/unsubscribe/bounce/complaint/cooldown), footer and RFC 8058 headers are applied before **every** send, for every provider. Microsoft mail is sent as **MIME** so `List-Unsubscribe` survives (Graph's JSON form only allows `x-` headers).
* A mailbox that can't send pauses the campaign **before claiming anything**, with a reason a user can act on: *"Your mailbox needs to be reconnected before LeadGennie can continue sending."* Sends stay `pending`; resume after fixing.
* Provider says the account can't send at all (Gmail API disabled, no Exchange mailbox) ⇒ mailbox `error` + campaign paused; a passing **test email** clears `error`.
* 401 ⇒ refresh once and retry; still rejected, or refresh says `invalid_grant` ⇒ `reconnect_required`, `mailbox.auth_failed`, all running campaigns on that mailbox paused.
* **Disconnect:** revoke at Google (best-effort), delete both tokens in the same statement that sets `disconnected`, pause running campaigns, keep every message/thread/analytics row. Microsoft offers no per-app revoke endpoint: our copy is deleted and the confirmation tells the user to also remove the app at myapps.microsoft.com.

### Activity log

`mailbox.connected · reconnected · disconnected · auth_failed · paused · resumed · error · test_sent` are written to `activities` (user-visible audit). **High-volume events are not:** token refreshes go to structured logs (`mailbox.token_refreshed`, ids only), and each email's outcome is the durable `messages` row (`sent`/`failed` + `error_class`) — putting them in the append-only activity feed would drown it.

## 6. Inbox groundwork (what exists, what does not)

Exists and is tested: the normalised `EmailMessage` / `EmailThread` (`lib/email/mailbox-provider.ts`), Gmail and Graph normalisers, `listMessages` / `getThread` behind `capabilities.inboxSync`, `providerThreadId` / `providerMessageId` stored on sends, and provider-independent **reply detection** (`lib/domain/mailboxes/replies.ts`: `In-Reply-To` → `References` → shared thread; auto-replies flagged, not dropped).

**Not built (Phase 6):** the sync job/cursor, persisting inbound messages, the Inbox UI, classification, reply sending. Not built by design: `createDraft`, `syncMessages` (the optional methods in the brief). Microsoft `sendMail` returns no message/conversation id, so Microsoft sends have `provider_message_id = null` until the inbox scope lets us read Sent Items — stored honestly as null, not invented.

## 7. Provider setup

### Google (Gmail / Workspace)
1. Google Cloud console → new/selected project → **APIs & Services → Library → Gmail API → Enable**. (Not enabling it produces `accessNotConfigured`, which LeadGennie reports as a setup error on the mailbox.)
2. **OAuth consent screen**: user type *External* (or *Internal* if only your Workspace org will connect). App name/logo/support email; authorised domain = your app's domain. **Scopes**: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`.
3. **Credentials → Create credentials → OAuth client ID → Web application.** Authorised redirect URIs — exactly:
   * `https://<your-host>/api/mailboxes/google/callback`
   * `http://localhost:3000/api/mailboxes/google/callback` (local dev)
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (and `GOOGLE_REDIRECT_URI` only if it differs from the default).
5. **While the consent screen is in *Testing*:** only listed test users can connect, **and Google expires refresh tokens after 7 days** — mailboxes will flip to *Reconnect required* weekly. Move to *In production* and complete Google's verification for the sensitive `gmail.send` scope before real use.

### Microsoft (Microsoft 365 / Outlook)
1. Microsoft Entra admin center → **App registrations → New registration**. Supported account types: *Accounts in any organizational directory and personal Microsoft accounts* (matches the default `MICROSOFT_TENANT=common`), or a single tenant (then set `MICROSOFT_TENANT`).
2. Redirect URI, platform **Web**: `https://<your-host>/api/mailboxes/microsoft/callback` (and the localhost one for dev).
3. **Certificates & secrets → New client secret** — copy the *Value* immediately. Secrets expire (≤ 24 months): calendar a rotation.
4. **API permissions → Microsoft Graph → Delegated**: `Mail.Send`, `User.Read`, `offline_access`, `openid`, `email`, `profile`. Some tenants require admin consent — a blocked user sees Microsoft's own consent error and LeadGennie reports "authorization failed".
5. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (`MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT` optional). Publisher verification is recommended for multi-tenant apps.
6. The signed-in account needs an **Exchange Online mailbox**; without one Graph answers `MailboxNotEnabledForRESTAPI` and the mailbox goes to *Error* with an explanation.

### Environment
| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google | Empty ⇒ the Google card says "Not set up on this server" |
| `GOOGLE_REDIRECT_URI` | no | Default `<app URL>/api/mailboxes/google/callback` |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | for Microsoft | |
| `MICROSOFT_REDIRECT_URI` | no | Default `<app URL>/api/mailboxes/microsoft/callback` |
| `MICROSOFT_TENANT` | no | `common` (default) or a tenant id |
| `NEXT_PUBLIC_APP_URL` | **yes in production** | The redirect URI and the landing redirects are derived from it. It is inlined at **build** time. |
| `CREDENTIALS_ENCRYPTION_KEY` | already required | **Losing/rotating it makes every stored mailbox token unreadable ⇒ every mailbox must be reconnected.** Back it up like a database credential. |

## 8. Local development & testing

* Nothing in tests touches a network or a real mailbox: OAuth endpoints are a scripted client (`tests/helpers/mailboxes.ts`), providers are `FakeMailProvider({ name: "gmail", idempotent: false })`, adapters are tested against a mocked `fetch`.
* To exercise real Google locally: create a *Testing*-mode OAuth client with the localhost redirect, add yourself as a test user, put the two vars in `.env.local`, run `npm run dev` **and** `npm run worker`, connect, click the paper-plane icon on the mailbox row.
* Suites: `mime`, `mailbox-domain`, `mailbox-oauth`, `mailbox-providers`, `mailbox-boundaries` (unit); `mailbox-connect`, `mailbox-lifecycle`, `mailbox-sending`, `mailbox-routes` (integration, PGlite).

## 9. Production rollout

1. Create the Google and/or Microsoft app (section 7); set env vars; make sure `NEXT_PUBLIC_APP_URL` is the public origin **at build time**.
2. `npm run db:migrate` — applies `0014` (additive; existing mailboxes untouched). Also applies any earlier pending migrations (0011/0012 at time of writing) — read `docs/deployment.md` first.
3. Deploy web **and** worker (sending happens in the worker).
4. Settings → Mailboxes → Connect → **Send test email** → launch a small campaign.

## 10. Known limits / follow-ups

* **Verified against stubs, not live providers.** No Google/Microsoft credentials were available. The adapters follow the documented APIs and are exercised against mocked HTTP, and the OAuth + send flow was run in the built app against a stub of Google's endpoints — but *the first real connect and send are yours to do* (section 9.4). Points to watch on that first run: that Gmail preserves `List-Unsubscribe` from the raw MIME, and that Graph accepts MIME with custom headers via `sendMail` (the footer's unsubscribe link is always present regardless).
* Follow-ups in a sequence are not yet threaded onto the first email for Gmail (the send port supports `threadId`/`In-Reply-To`; wiring campaign steps to it belongs with Phase 6 threading).
* Microsoft sends carry no message id / conversation id until the inbox scope exists.
* Google's 7-day refresh-token expiry in *Testing* mode, Microsoft secret expiry, and the sensitive/restricted-scope review are operational, not code, concerns — see section 7.
