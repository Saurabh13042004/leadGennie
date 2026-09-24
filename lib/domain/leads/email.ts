import { DISPOSABLE_DOMAINS, EMAIL_LISTS_VERSION, FREE_MAIL_DOMAINS, ROLE_LOCAL_PARTS } from "./email-lists.ts";

/**
 * Email classification (WP1.3). Pure and synchronous; the optional MX result is
 * passed in by the caller (see mx.ts) so this stays deterministic and testable.
 *
 * Status semantics — deliberately honest about what we actually know:
 *   invalid     – not a deliverable address (bad syntax, or the domain has no mail server)
 *   risky       – syntactically fine but a poor target: role account or disposable domain
 *   valid       – syntax OK, not risky, AND the domain publishes an MX record
 *                 (this does NOT prove the mailbox exists — no third-party verifier in V1)
 *   unverified  – syntax OK, not risky, MX not checked
 *
 * Imported directly by scripts/backfill-email-status.mjs: relative `.ts` import only.
 */
export { EMAIL_LISTS_VERSION };

export type EmailStatus = "unverified" | "valid" | "invalid" | "risky";
export type EmailFlag = "invalid_syntax" | "role_account" | "disposable" | "free_mail" | "no_mx";
export type MxResult = "has_mx" | "no_mx" | "unknown";

export type EmailClassification = {
  /** Trimmed + lowercased, or null when no email was supplied. */
  email: string | null;
  domain: string | null;
  status: EmailStatus;
  flags: EmailFlag[];
  /** Human-readable, one per flag that matters to the user. Free-mail is informational and has none. */
  reasons: string[];
};

const LOCAL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export function normalizeEmail(raw: string | null | undefined): string | null {
  let s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^mailto:/, "");
  const angled = s.match(/<([^<>]+)>\s*$/);
  if (angled) s = angled[1];
  s = s.trim();
  return s || null;
}

/** RFC-pragmatic: what real mail servers accept, not every oddity the RFC allows (no quoted locals, no IP literals). */
export function isValidEmailSyntax(email: string): boolean {
  if (email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at < 1 || at !== email.indexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64) return false;
  return LOCAL_RE.test(local) && DOMAIN_RE.test(domain);
}

export function emailDomain(email: string | null | undefined): string | null {
  const e = normalizeEmail(email);
  if (!e) return null;
  const at = e.lastIndexOf("@");
  return at > 0 ? e.slice(at + 1) : null;
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  return !!domain && FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}

export function isDisposableDomain(domain: string | null | undefined): boolean {
  return !!domain && DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/** A role account is judged on the local part alone, ignoring "+tag" suffixes ("sales+x@"). */
export function isRoleLocalPart(local: string): boolean {
  return ROLE_LOCAL_PARTS.has(local.split("+")[0]);
}

/** Company domain implied by an email, or null for personal/disposable providers. */
export function corporateDomainFromEmail(email: string | null | undefined): string | null {
  const domain = emailDomain(email);
  if (!domain || isFreeMailDomain(domain) || isDisposableDomain(domain)) return null;
  return domain;
}

export function classifyEmail(raw: string | null | undefined, opts: { mx?: MxResult } = {}): EmailClassification {
  const email = normalizeEmail(raw);
  if (!email) return { email: null, domain: null, status: "unverified", flags: [], reasons: [] };

  if (!isValidEmailSyntax(email)) {
    return {
      email,
      domain: emailDomain(email),
      status: "invalid",
      flags: ["invalid_syntax"],
      reasons: ["Not a valid email address"],
    };
  }

  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const flags: EmailFlag[] = [];
  const reasons: string[] = [];

  if (isDisposableDomain(domain)) {
    flags.push("disposable");
    reasons.push("Disposable email domain");
  }
  if (isRoleLocalPart(local)) {
    flags.push("role_account");
    reasons.push("Role account (not a person)");
  }
  if (isFreeMailDomain(domain)) flags.push("free_mail");

  if (opts.mx === "no_mx") {
    flags.push("no_mx");
    reasons.push("Domain has no mail server (no MX record)");
    return { email, domain, status: "invalid", flags, reasons };
  }
  if (flags.includes("disposable") || flags.includes("role_account")) {
    return { email, domain, status: "risky", flags, reasons };
  }
  return { email, domain, status: opts.mx === "has_mx" ? "valid" : "unverified", flags, reasons };
}
