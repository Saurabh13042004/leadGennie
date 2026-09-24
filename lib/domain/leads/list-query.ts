/**
 * Lead-list query parameters: parsed once, at the boundary, from the URL into
 * a typed, allow-listed shape. Nothing downstream ever sees a raw query string
 * (parse, don't validate), and sort columns can never be attacker-chosen SQL.
 */
export const LEAD_PAGE_SIZE = 50;

export const LEAD_SORT_KEYS = ["created", "name", "company", "stage", "email_status"] as const;
export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

export const EMAIL_STATUS_FILTERS = ["unverified", "valid", "invalid", "risky", "none"] as const;
export type EmailStatusFilter = (typeof EMAIL_STATUS_FILTERS)[number];

export type LeadListQuery = {
  page: number;
  search: string;
  stage: string;
  source: string;
  /** "none" = leads with no email address. */
  emailStatus: EmailStatusFilter | "";
  companyId: number | null;
  sort: LeadSortKey;
  dir: "asc" | "desc";
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseLeadListParams(sp: RawSearchParams): LeadListQuery {
  const page = Number.parseInt(first(sp.page), 10);
  const companyId = Number.parseInt(first(sp.company), 10);
  const sort = first(sp.sort) as LeadSortKey;
  const emailStatus = first(sp.email_status) as EmailStatusFilter;
  return {
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1,
    search: first(sp.q).trim().slice(0, 100),
    stage: first(sp.stage).trim().slice(0, 50),
    source: first(sp.source).trim().slice(0, 50),
    emailStatus: EMAIL_STATUS_FILTERS.includes(emailStatus) ? emailStatus : "",
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
    sort: LEAD_SORT_KEYS.includes(sort) ? sort : "created",
    dir: first(sp.dir) === "asc" ? "asc" : "desc",
  };
}

/** Query → URL search string (only non-default values), used by the filter bar and pager. */
export function leadListQueryString(q: Partial<LeadListQuery>): string {
  const p = new URLSearchParams();
  if (q.search) p.set("q", q.search);
  if (q.stage) p.set("stage", q.stage);
  if (q.source) p.set("source", q.source);
  if (q.emailStatus) p.set("email_status", q.emailStatus);
  if (q.companyId) p.set("company", String(q.companyId));
  if (q.sort && q.sort !== "created") p.set("sort", q.sort);
  if (q.dir && q.dir !== "desc") p.set("dir", q.dir);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
