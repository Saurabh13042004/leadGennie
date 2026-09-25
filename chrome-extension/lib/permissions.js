/**
 * The install-time permission list is deliberately tiny (see manifest.json). Reaching a LeadGennie server outside the
 * built-in addresses is a one-off, user-approved grant for THAT origin only — never a blanket "all sites" permission.
 * `chrome.permissions.request` needs a user gesture, so callers must invoke this directly from a click handler.
 */
export function originPattern(apiBase) {
  return `${new URL(apiBase).origin}/*`;
}

export async function hasOriginAccess(apiBase) {
  return chrome.permissions.contains({ origins: [originPattern(apiBase)] });
}

export async function requestOriginAccess(apiBase) {
  if (await hasOriginAccess(apiBase)) return true;
  return chrome.permissions.request({ origins: [originPattern(apiBase)] });
}
