import type { AccessTokenSource, MailboxProvider, MailboxRef } from "@/lib/email/mailbox-provider";
import { isMailboxProvider, type MailboxProviderKey } from "./types";

/**
 * Mailbox provider registry: provider key → factory that builds the adapter for ONE mailbox. Campaign, sequence, inbox and agent
 * code asks `resolveMailboxProvider(mailbox.provider, ref)` and gets something with the `MailboxProvider` contract — it never
 * branches on the provider. Adding a provider = one `registerMailboxProvider` call (see register.ts). Unknown key fails closed.
 */

/** `tokens` overrides where the adapter gets its bearer token — used while connecting, before the mailbox (and its stored credentials) exist. */
export type MailboxProviderFactory = (ref: MailboxRef, tokens?: AccessTokenSource) => MailboxProvider;

const factories = new Map<MailboxProviderKey, MailboxProviderFactory>();
const overrides = new Map<MailboxProviderKey, MailboxProvider>();

export function registerMailboxProvider(key: MailboxProviderKey, factory: MailboxProviderFactory): void {
  factories.set(key, factory);
}

export class UnknownMailboxProviderError extends Error {
  constructor(key: string) {
    super(`No mail provider is registered for "${key}"`);
    this.name = "UnknownMailboxProviderError";
  }
}

export function resolveMailboxProvider(key: string, ref: MailboxRef, tokens?: AccessTokenSource): MailboxProvider {
  if (!isMailboxProvider(key)) throw new UnknownMailboxProviderError(key);
  const override = overrides.get(key);
  if (override) return override;
  const factory = factories.get(key);
  if (!factory) throw new UnknownMailboxProviderError(key);
  return factory(ref, tokens);
}

/** Test seam (dependency inversion): route every mailbox of this provider to a fake. `null` restores the real one. */
export function setMailboxProviderOverride(key: MailboxProviderKey, provider: MailboxProvider | null): void {
  if (provider) overrides.set(key, provider);
  else overrides.delete(key);
}

export function clearMailboxProviderOverrides(): void {
  overrides.clear();
}
