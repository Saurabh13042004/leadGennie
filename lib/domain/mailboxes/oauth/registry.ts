import { appBaseUrl } from "@/lib/campaigns/render";
import { GoogleOAuthClient } from "./google";
import { MicrosoftOAuthClient } from "./microsoft";
import type { OAuthProviderClient } from "./types";
export { isOAuthSlug, OAUTH_SLUGS, slugFor, type OAuthSlug } from "./slug";
import { slugFor } from "./slug";
import type { OAuthMailboxProvider } from "../types";

/** Registry (open/closed): a new OAuth provider is one entry here plus its client — no `if (provider === …)` anywhere else. */
const factories: Record<OAuthMailboxProvider, () => OAuthProviderClient> = {
  gmail: () => new GoogleOAuthClient(),
  microsoft: () => new MicrosoftOAuthClient(),
};
const overrides = new Map<OAuthMailboxProvider, OAuthProviderClient>();

export function getOAuthClient(provider: OAuthMailboxProvider): OAuthProviderClient {
  return overrides.get(provider) ?? factories[provider]();
}

/** Test seam: install a scripted client; pass null to restore the real ones. */
export function setOAuthClient(provider: OAuthMailboxProvider, client: OAuthProviderClient | null): void {
  if (client) overrides.set(provider, client);
  else overrides.delete(provider);
}

/** Must match what is registered with the provider byte for byte, so it is either set explicitly or derived from the public app URL. */
export function redirectUriFor(provider: OAuthMailboxProvider, env: Record<string, string | undefined> = process.env): string {
  const explicit = (provider === "gmail" ? env.GOOGLE_REDIRECT_URI : env.MICROSOFT_REDIRECT_URI)?.trim();
  return explicit || `${appBaseUrl()}/api/mailboxes/${slugFor(provider)}/callback`;
}
