import { PROVIDER_LABEL, type OAuthMailboxProvider } from "../types";

/**
 * Every way connecting a mailbox can fail, as a stable code (safe to put in a redirect URL) and the sentence a user sees.
 * Plain module: the settings page maps `?mailbox_error=<code>` to text with `connectErrorMessage`. Raw provider errors never
 * reach the user — they are logged server-side (without credentials) by the callback route.
 */
export type ConnectErrorCode =
  | "not_configured" | "state_invalid" | "state_expired" | "state_mismatch" | "access_denied" | "exchange_failed" | "provider_error"
  | "scope_missing" | "email_unverified" | "no_refresh_token" | "identity_mismatch" | "address_in_use" | "target_missing" | "forbidden";

export const CONNECT_ERROR_CODES: readonly ConnectErrorCode[] = [
  "not_configured", "state_invalid", "state_expired", "state_mismatch", "access_denied", "exchange_failed", "provider_error",
  "scope_missing", "email_unverified", "no_refresh_token", "identity_mismatch", "address_in_use", "target_missing", "forbidden",
];

export const isConnectErrorCode = (v: string): v is ConnectErrorCode => (CONNECT_ERROR_CODES as readonly string[]).includes(v);

export function connectErrorMessage(code: ConnectErrorCode, provider?: OAuthMailboxProvider): string {
  const who = provider ? PROVIDER_LABEL[provider] : "your email provider";
  switch (code) {
    case "not_configured": return `${who} sign-in isn't set up on this server yet. Ask whoever runs LeadGennie to add the ${who} credentials (see docs/mailboxes.md).`;
    case "state_invalid":
    case "state_mismatch": return `That ${who} sign-in didn't start from this page, so it was ignored for your security. Please try connecting again.`;
    case "state_expired": return `The ${who} sign-in took too long and expired. Please try connecting again.`;
    case "access_denied": return `You cancelled the ${who} sign-in, so nothing was connected.`;
    case "exchange_failed": return `${who} authorization failed. Please try connecting your ${who} account again.`;
    case "provider_error": return `${who} couldn't be reached. Please try again in a minute.`;
    case "scope_missing": return `LeadGennie needs permission to send email from your ${who} account. Try again and leave the "send email" permission ticked.`;
    case "email_unverified": return `${who} couldn't confirm you own that email address, so it wasn't connected.`;
    case "no_refresh_token": return `${who} didn't allow LeadGennie to stay signed in. Remove LeadGennie under your ${who} account's connected apps, then connect again.`;
    case "identity_mismatch": return `You signed in with a different ${who} account than the one being reconnected. Sign in as the original mailbox, or connect the other account as a new mailbox.`;
    case "address_in_use": return "That email address is already set up as a mailbox in this workspace. Remove or disconnect it first.";
    case "target_missing": return "That mailbox no longer exists in this workspace.";
    case "forbidden": return "Only workspace owners and admins can connect mailboxes.";
  }
}
