/** LinkedIn *person* profile URL → canonical `https://www.linkedin.com/in/<slug>`, or null if it isn't one. */
export function normalizeLinkedinUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
  const match = url.pathname.match(/^\/(?:in|pub)\/([^/]+)/i);
  if (!match) return null;
  const slug = match[1];
  return `https://www.linkedin.com/in/${slug}`;
}

/** Lowercased profile slug ("janedoe") — the identity used to recognize the same person across URL spellings. */
export function linkedinSlug(url: string | null | undefined): string | null {
  const normalized = normalizeLinkedinUrl(url);
  return normalized ? normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase() : null;
}
