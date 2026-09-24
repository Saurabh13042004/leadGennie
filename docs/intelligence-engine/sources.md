# Sources, Fetching & Extraction

Collectors **get information**. They do not judge it. A collector returns raw, captured documents; everything after (extraction → agents → validation) decides what they mean.

## Collector interface

```python
class Collector(Protocol):
    name: str                      # "website", "news", ...
    source_type: SourceType        # website | careers | news | search | jobs_board | public_data
    async def collect(self, query: CollectQuery, budget: Budget, ctx: RunContext) -> list[RawDocument]: ...

class RawDocument(BaseModel):
    url: str; final_url: str; title: str | None
    fetched_at: datetime; status_code: int; content_type: str
    text: str                       # cleaned main text
    html_hash: str                  # sha256 of raw body
    published_at: datetime | None   # only if the page states it
    source_type: SourceType; collector: str
    metadata: dict                  # json-ld, meta tags, headings
```
Every document lands in the run's **document set** (and `intel.source_cache`). The Evidence Validator accepts a source URL **only if it is in this set**.

## V1 connectors

| Connector | What it does | Phase | Notes |
|---|---|---|---|
| `web_search` | Runs planned queries through a search API adapter → result URLs/snippets | 2A | Provider per D-03 (verify API terms/price). Search results are *leads to fetch*, not evidence by themselves |
| `website` | Fetches homepage, about, product/solutions, pricing, careers, blog/news, team/leadership pages of the company domain (link discovery from homepage + sitemap, capped) | 2A | First-party = highest evidence tier |
| `news` | Company-name/domain news via news-search API or RSS; dedup by canonical URL | 2A | Recency filter; reputable-source tiering |
| `jobs` | Careers page + public ATS pages (e.g. Greenhouse/Lever/Ashby public boards — verify current public endpoints) + search for postings | 2A | Extract role title, function, location, posted date, URL |
| `public_data` | Licensed structured data (company registry/funding datasets, people/company APIs) | 8 (D-03) | Also hosts discovery: `search_companies`, `search_people` |
| `public_profiles` | **Deferred.** Server-side scraping of LinkedIn etc. is against their terms — **do not build**. Profile data enters only via the user-initiated Chrome extension (Phase 7) | — | Needs explicit legal decision |
| `reddit` | **Deferred.** Low signal, API terms; revisit post-V1 | — | |

## Fetch layer guardrails (`sources/fetch.py`, used by every collector)

- **SSRF defense:** http/https only; resolve DNS and block private, loopback, link-local, metadata (`169.254.169.254`), and internal ranges; re-check on **every redirect** and after DNS re-resolution (rebinding); cap redirects (5).
- **robots.txt** honored (cached); per-host rate limit (e.g. ≤1 req/s/host, DB-backed shared limiter so replicas don't multiply it); honest User-Agent `LeadGennieBot/1.0 (+https://<site>/bot)` with contact URL.
- Timeouts (connect 5 s / total 15 s), max body size (2 MB), content-type allowlist (`text/html`, `application/xhtml+xml`, `text/plain`, `application/json`, RSS/Atom), decompression bomb guard.
- **No** login-wall bypass, CAPTCHA solving, proxy rotation to evade blocks, or fingerprint spoofing. A block/403/429 → record and move on; never escalate.
- No JavaScript rendering in V1 (httpx + parser). Headless rendering only later, behind a flag, for allowed hosts.
- Content cleaning: main-text extraction (readability-style; candidate libs: trafilatura / selectolax / BeautifulSoup — pick by test fixtures), strip scripts/styles, cap tokens per doc, keep headings and JSON-LD.
- Caching: ETag/Last-Modified + `html_hash`; `freshness_days` from the request decides reuse; cache stores only public content.
- **Prompt-injection hygiene:** cleaned text is wrapped in delimited blocks when given to an LLM; a heuristic scanner flags injection-like strings ("ignore previous instructions…") → flagged in trace and the document is down-weighted (never blindly dropped, never obeyed).

## Search planner (`pipeline/planner.py`)

Deterministic query templates parameterized by company/ICP/offer keywords, e.g.:
- `"{company}" funding OR raised OR "Series"` · `"{company}" expansion OR launches OR "new office"` · `"{company}" hiring {role_keywords}` · `site:{domain} careers` · `"{company}" {offer_keyword} tools`
An LLM may *propose additional queries* (structured, capped, deduped) but the template set guarantees baseline coverage and predictable cost. Queries executed in priority order until `max_search_queries`/budget.

## Extraction (`extraction/`)

Deterministic first, LLM-structured second:
1. **Deterministic:** JSON-LD/OpenGraph/meta, headings, address/phone patterns, job-board schemas, date parsing (only dates that are *stated*), link classification.
2. **LLM structured extraction** over cleaned text into pydantic schemas: `CompanyFacts`, `PersonFacts`, `JobPosting[]`, `Event[]` (funding/launch/expansion/leadership-change/tech-change mentions). Each extracted field must include a **`source_span`** (quote from the text) so the validator can verify presence. Extraction never invents: fields not present are `null`.
3. Extraction outputs are *candidate facts*. They become evidence-backed claims only after validation.

## Testing

- Collectors: recorded HTTP fixtures (cassettes) — no live network in CI; a `tests/fixtures/sites/` corpus of saved pages (clean company site, JS-heavy shell, careers page, news article, hostile prompt-injection page, misleading page that mentions the company only in a list).
- Fetch guardrails: SSRF suite (private IPs, redirects to metadata, DNS rebinding simulation, giant body, wrong content-type).
- Extraction: golden files for expected structured output per fixture page.
- Live smoke (manual, not CI): `make smoke DOMAIN=example.com` runs a real budget-limited run.

## As built (Phase 2A)

- **Search planner is deterministic only** (no LLM-proposed queries yet): funding / expansion / hiring / leadership templates + up to 2 offer-keyword queries + a `"name" "domain"` query. Web-search queries feed `web_search`, funding/expansion/leadership queries feed `news`.
- **Search provider:** Brave adapter (`BRAVE_API_KEY`, `SEARCH_PROVIDER=brave`); `NullSearch` otherwise — connectors then skip with a visible warning (`web_search_unavailable`, `news_unavailable`) and the run continues on first-party pages + job boards. Endpoint paths/response shapes follow Brave's documented web/news search API but **were not exercised live** (no key yet): confirm at the first `make smoke` with a key (decision D-03).
- **Website connector** allowance: ~40% of the page budget, max 8; nav-discovered pages first (careers, about, team, news, product, pricing, blog), default paths only for categories with no link (one default each); the blog RSS feed's first two items are read; off-site links are never followed.
- **Jobs connector** reads Greenhouse / Lever / Ashby public JSON APIs only for boards **linked from the company's own pages**, and records `linked_from` so the validator can bind the board to the company. If a careers page isn't linked to a board (e.g. JS-rendered), the LLM extracts roles from the careers page text instead (spans required).
- **Guardrail specifics:** robots — 4xx ⇒ allowed, 5xx/timeout ⇒ conservatively disallowed for the run; per-host limiter is shared via Postgres across replicas (and jitter-proof in-memory); redirect targets are re-resolved and re-checked; the connected peer address is re-checked (`network_stream.server_addr`) — a rebinding attempt can still cause one GET to reach an internal host before the response is discarded, so also deploy the engine with egress restricted to the public internet (network policy), see `development.md`.
- **Job function classification** uses the ATS department when present, otherwise title rules (customer_success → sales → engineering → marketing → product → …). The live run showed regex-only classification mislabels edge titles; treat function-level counts as approximate.
