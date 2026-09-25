/**
 * Which browser extensions may obtain tokens through the connect flow.
 *
 * The extension's ID is pinned by the `key` in chrome-extension/manifest.json, so it is the same on every
 * machine that loads it. The consent page only ever redirects a one-time code to
 * `https://<allowed-id>.chromiumapp.org/…` — a different extension (or a web page) that starts the flow
 * cannot receive one. A Web Store build gets a different ID: add it with EXTENSION_ALLOWED_IDS (comma-separated).
 */
export const OFFICIAL_EXTENSION_ID = "hfhoiegnochpbnljpnkkcmdeafbdpaoh";

const ID_RE = /^[a-p]{32}$/;

export function allowedExtensionIds(extra: string | undefined = process.env.EXTENSION_ALLOWED_IDS): string[] {
  const more = (extra ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => ID_RE.test(s));
  return Array.from(new Set([OFFICIAL_EXTENSION_ID, ...more]));
}

export type RedirectCheck = { ok: true; extensionId: string } | { ok: false; reason: string };

/** Only `https://<extension-id>.chromiumapp.org/<path>` for an allow-listed ID, with no credentials or fragment. */
export function checkExtensionRedirect(uri: string, allowed: string[] = allowedExtensionIds()): RedirectCheck {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return { ok: false, reason: "The redirect address is not a valid URL." };
  }
  const m = /^([a-p]{32})\.chromiumapp\.org$/.exec(url.hostname);
  if (url.protocol !== "https:" || !m || url.username || url.password || url.port || url.hash) {
    return { ok: false, reason: "The redirect address is not a browser-extension address." };
  }
  if (!allowed.includes(m[1])) return { ok: false, reason: "This extension is not recognised by LeadGennie." };
  return { ok: true, extensionId: m[1] };
}
