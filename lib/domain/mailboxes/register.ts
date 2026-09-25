// Importing this module registers the real mailbox providers. Add a new provider here — nothing else needs to change.
import { GmailMailboxProvider } from "@/lib/email/gmail-provider";
import { MicrosoftMailboxProvider } from "@/lib/email/microsoft-provider";
import { getMailProvider, isMailProviderOverridden } from "@/lib/email/provider";
import { ResendProvider } from "@/lib/email/resend-provider";
import type { MailboxProvider } from "@/lib/email/mailbox-provider";
import { getOAuthClient } from "./oauth/registry";
import { registerMailboxProvider } from "./registry";
import { tokenSourceFor } from "./token-source";

registerMailboxProvider("gmail", (ref, tokens) => new GmailMailboxProvider(ref, tokens ?? tokenSourceFor(ref, "gmail"), fetch, () => getOAuthClient("gmail").isConfigured()));
registerMailboxProvider("microsoft", (ref, tokens) => new MicrosoftMailboxProvider(ref, tokens ?? tokenSourceFor(ref, "microsoft"), fetch, () => getOAuthClient("microsoft").isConfigured()));
// Resend sends with the platform API key. `setMailProvider(fake)` — the seam the sending tests already use — still wins.
registerMailboxProvider("resend", (ref) => (isMailProviderOverridden() ? (getMailProvider() as MailboxProvider) : new ResendProvider(ref)));
