import { classifyEmail, isFreeMailDomain, normalizeEmail } from "@/lib/domain/leads/email";
import { normalizeDomain } from "@/lib/domain/companies/normalize";
import { normalizeLinkedinUrl } from "@/lib/domain/leads/urls";
import { cleanText } from "@/lib/domain/leads/validate";
import { linkedinProfilePath, parseLinkedinTitle } from "./linkedin";
import { extractLinkedinText } from "./linkedin-text";
import type { FieldName, FieldSource, PageFacts, PageKind } from "./schemas";

/**
 * Deterministic extractors (Strategy + registry): each turns page facts into PROPOSED field values. They never
 * touch the database or a model, so they are cheap, free, unit-testable, and cannot hallucinate. The pipeline
 * (service.ts) merges them in priority order and only calls the LLM for what they could not find.
 */
export type Proposal = Partial<Record<FieldName, string>>;
export interface Extractor {
  readonly name: FieldSource;
  extract(facts: PageFacts, kind: PageKind): Proposal;
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export function classifyPage(url: string): PageKind {
  const host = hostOf(url);
  if (!host) return "web";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return linkedinProfilePath(url) ? "linkedin_profile" : "linkedin_other";
  return "web";
}

/** Sites whose domain says nothing about the prospect's employer. */
const NON_COMPANY_HOSTS = new Set([
  "linkedin.com", "google.com", "docs.google.com", "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com",
  "github.com", "gitlab.com", "medium.com", "substack.com", "notion.so", "notion.site", "wikipedia.org", "reddit.com",
  "crunchbase.com", "angel.co", "wellfound.com", "glassdoor.com", "indeed.com", "zoominfo.com", "apollo.io", "bing.com",
]);

function isNonCompanyHost(host: string): boolean {
  const bare = host.replace(/^www\./, "");
  return [...NON_COMPANY_HOSTS].some((h) => bare === h || bare.endsWith(`.${h}`));
}

// ---- JSON-LD -----------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function* flattenJsonLd(node: unknown, depth = 0): Generator<Json> {
  if (depth > 5) return;
  if (Array.isArray(node)) {
    for (const n of node) yield* flattenJsonLd(n, depth + 1);
  } else if (isObj(node)) {
    yield node;
    if (node["@graph"]) yield* flattenJsonLd(node["@graph"], depth + 1);
  }
}

const hasType = (o: Json, type: string) => {
  const t = o["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
};

export const jsonLdExtractor: Extractor = {
  name: "jsonld",
  extract(facts) {
    const out: Proposal = {};
    for (const node of facts.jsonld.flatMap((j) => [...flattenJsonLd(j)])) {
      if (hasType(node, "Person") && !out.fullName) {
        const name = asStr(node.name);
        if (name) out.fullName = name;
        const jobTitle = asStr(node.jobTitle);
        if (jobTitle) out.jobTitle = jobTitle;
        const works = node.worksFor;
        const org = Array.isArray(works) ? works[0] : works;
        if (isObj(org)) {
          const cn = asStr(org.name);
          if (cn) out.company = cn;
          const url = asStr(org.url);
          const d = url ? normalizeDomain(url) : null;
          if (d) out.companyDomain = d;
        } else if (asStr(org)) out.company = asStr(org);
        const email = asStr(node.email)?.replace(/^mailto:/i, "");
        if (email) out.email = email;
        const same = ([] as unknown[]).concat(node.sameAs ?? []).map(asStr).filter((x): x is string => !!x);
        const li = same.map((u) => normalizeLinkedinUrl(u)).find((u): u is string => !!u);
        if (li) out.linkedinUrl = li;
      } else if (hasType(node, "Organization") && !out.company && !hasType(node, "Person")) {
        const name = asStr(node.name);
        if (name) out.company = name;
        const url = asStr(node.url);
        const d = url ? normalizeDomain(url) : null;
        if (d && !out.companyDomain) out.companyDomain = d;
      }
    }
    return out;
  },
};

// ---- LinkedIn profile --------------------------------------------------------------------------------------

export const linkedinProfileExtractor: Extractor = {
  name: "linkedin_title",
  extract(facts, kind) {
    if (kind !== "linkedin_profile") return {};
    const out: Proposal = {};
    const slug = linkedinProfilePath(facts.url);
    const canonical = slug ? normalizeLinkedinUrl(`https://www.linkedin.com/in/${slug}`) : null;
    if (canonical) out.linkedinUrl = canonical;
    const parsed = parseLinkedinTitle(facts.title);
    // The page's <h1> is the owner's name; prefer it when it agrees with the title's first segment.
    const h1 = facts.headings[0]?.trim();
    const name = parsed.name && h1 && h1.toLowerCase().startsWith(parsed.name.toLowerCase().slice(0, 4)) ? h1 : parsed.name ?? h1;
    if (name && !/^linkedin$/i.test(name)) out.fullName = name;
    if (parsed.jobTitle) out.jobTitle = parsed.jobTitle;
    if (parsed.company) out.company = parsed.company;
    return out;
  },
};

// ---- LinkedIn page text (headline, top card, Experience) -----------------------------------------------------------

export const linkedinTextExtractor: Extractor = {
  name: "linkedin_text",
  extract(facts, kind) {
    if (kind !== "linkedin_profile") return {};
    const name = facts.headings[0]?.trim() || parseLinkedinTitle(facts.title).name;
    return extractLinkedinText(facts.text, name, facts.hints);
  },
};

// ---- Selection (an explicit user signal) -------------------------------------------------------------------

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export const selectionExtractor: Extractor = {
  name: "selection",
  extract(facts) {
    const sel = cleanText(facts.selection);
    if (!sel) return {};
    const out: Proposal = {};
    const email = sel.match(EMAIL_IN_TEXT)?.[0];
    if (email) out.email = email;
    // A short capitalised run with no digits/@ is a person's name ("Sarah Chen").
    const words = sel.replace(EMAIL_IN_TEXT, "").replace(/[<>()"',;:]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-ZÀ-ɏ][\p{L}'.-]*$/u.test(w))) out.fullName = words.join(" ");
    return out;
  },
};

// ---- The site itself ---------------------------------------------------------------------------------------

/** Paths where a site is speaking as the company itself ("/team", "/about", the home page…), not writing about someone. */
const COMPANY_PATH = /^\/?(?:(?:team|about|about-us|people|leadership|management|company|contact|contact-us|our-team|staff|who-we-are|our-story)(?:\/.*)?)?$/i;

export const siteExtractor: Extractor = {
  name: "site",
  extract(facts, kind) {
    if (kind !== "web") return {};
    const out: Proposal = {};
    const host = hostOf(facts.canonicalUrl || facts.url);
    if (!host || isNonCompanyHost(host)) return out;
    const site = asStr(facts.siteName);
    let path = "/";
    try {
      path = new URL(facts.canonicalUrl || facts.url).pathname;
    } catch {
      /* keep "/" */
    }
    // A blog post or article on someone's own site says nothing about their employer, so the host only counts when
    // the page looks like the company's own (or it names itself). It is still the weakest signal (see service.ts).
    if (site || COMPANY_PATH.test(path)) {
      const d = normalizeDomain(host);
      if (d) out.companyDomain = d;
    }
    if (site) out.company = site;
    return out;
  },
};

// ---- mailto: links -----------------------------------------------------------------------------------------

/** One unambiguous address on the page (a team page lists many — then we propose none rather than guess). */
export const mailtoExtractor: Extractor = {
  name: "mailto",
  extract(facts) {
    const unique = Array.from(new Set(facts.emails.map((e) => normalizeEmail(e)).filter((e): e is string => !!e)));
    const personal = unique.filter((e) => {
      const c = classifyEmail(e);
      return c.status !== "invalid" && !c.flags.includes("role_account") && !c.flags.includes("disposable");
    });
    return personal.length === 1 ? { email: personal[0] } : {};
  },
};

/** Highest priority first: an explicit selection and structured data beat inference from prose. */
export const DEFAULT_EXTRACTORS: Extractor[] = [selectionExtractor, jsonLdExtractor, linkedinProfileExtractor, linkedinTextExtractor, siteExtractor, mailtoExtractor];

/** Merge proposals: the first extractor to offer a field wins; the source is remembered. */
export function mergeProposals(
  facts: PageFacts,
  kind: PageKind,
  extractors: Extractor[] = DEFAULT_EXTRACTORS,
): { fields: Proposal; sources: Partial<Record<FieldName, FieldSource>> } {
  const fields: Proposal = {};
  const sources: Partial<Record<FieldName, FieldSource>> = {};
  for (const ex of extractors) {
    for (const [k, v] of Object.entries(ex.extract(facts, kind)) as [FieldName, string][]) {
      const value = cleanText(v);
      if (!value || fields[k]) continue;
      fields[k] = value;
      sources[k] = ex.name;
    }
  }
  return { fields, sources };
}

/** A free-mail address says nothing about the company: never let it stand in for a company domain. */
export function domainFromEmailIfCorporate(email: string | undefined): string | null {
  const e = normalizeEmail(email);
  if (!e) return null;
  const d = e.slice(e.lastIndexOf("@") + 1);
  return isFreeMailDomain(d) ? null : normalizeDomain(d);
}
