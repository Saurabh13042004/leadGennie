"""Jobs connector: finds public ATS boards linked from the company's pages and reads their public JSON
APIs (structured, no scraping). Job counts come from these records — never from a model estimate."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.contracts.common import SourceType
from app.documents import RawDocument
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.sources.base import CollectQuery, same_site
from app.sources.fetch import Fetcher, FetchError

_GREENHOUSE = re.compile(r"^(?:job-)?boards\.greenhouse\.io$")


def detect_boards(urls: list[str]) -> list[tuple[str, str, str]]:
    """-> [(ats, token, human_url)] found among the given links (deduplicated, stable order)."""
    found: dict[tuple[str, str], str] = {}
    for u in urls:
        p = urlparse(u)
        parts = [s for s in p.path.split("/") if s]
        host = (p.hostname or "").lower()
        if _GREENHOUSE.match(host) and parts:
            found.setdefault(("greenhouse", parts[0]), u)
        elif host == "jobs.lever.co" and parts:
            found.setdefault(("lever", parts[0]), u)
        elif host == "jobs.ashbyhq.com" and parts:
            found.setdefault(("ashby", parts[0]), u)
    return [(ats, token, human) for (ats, token), human in found.items()]


def api_url(ats: str, token: str) -> str:
    return {
        "greenhouse": f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs",
        "lever": f"https://api.lever.co/v0/postings/{token}?mode=json",
        "ashby": f"https://api.ashbyhq.com/posting-api/job-board/{token}",
    }[ats]


def parse_board(ats: str, data: Any) -> list[dict[str, str | None]]:
    """Normalize an ATS response into {title, location, department, posted_at, url}. Unknown shapes -> []."""
    rows: list[dict[str, str | None]] = []
    if ats == "greenhouse" and isinstance(data, dict):
        for j in data.get("jobs", []):
            loc = j.get("location") or {}
            rows.append(
                {
                    "title": j.get("title"),
                    "location": loc.get("name") if isinstance(loc, dict) else None,
                    "department": None,
                    "posted_at": j.get("updated_at") or j.get("first_published"),
                    "url": j.get("absolute_url"),
                }
            )
    elif ats == "lever" and isinstance(data, list):
        for j in data:
            cats = j.get("categories") or {}
            created = j.get("createdAt")
            rows.append(
                {
                    "title": j.get("text"),
                    "location": cats.get("location"),
                    "department": cats.get("team") or cats.get("department"),
                    "posted_at": (str(created) if created else None),
                    "url": j.get("hostedUrl"),
                }
            )
    elif ats == "ashby" and isinstance(data, dict):
        for j in data.get("jobs", []):
            rows.append(
                {
                    "title": j.get("title"),
                    "location": j.get("location"),
                    "department": j.get("department") or j.get("team"),
                    "posted_at": j.get("publishedAt") or j.get("publishedDate"),
                    "url": j.get("jobUrl"),
                }
            )
    return [r for r in rows if r["title"]]


def job_line(job: dict[str, str | None]) -> str:
    """The exact text line a posting occupies in the collected document (also its verifiable span)."""
    return f"{job['title']} — {job['location'] or 'location not stated'}" + (
        f" — {job['department']}" if job.get("department") else ""
    )


class JobsCollector:
    name = "jobs"

    def __init__(self, fetcher: Fetcher, max_boards: int = 2) -> None:
        self._fetcher, self._max_boards = fetcher, max_boards

    async def collect(self, ctx: PipelineContext, query: CollectQuery) -> list[RawDocument]:
        # Only boards linked from the company's OWN pages establish "this board belongs to this company".
        linked_from: dict[str, str] = {}
        for d in ctx.docs.documents():
            if query.domain and same_site(d.final_url, query.domain):
                for link in d.links:
                    linked_from.setdefault(link, d.url)
        docs: list[RawDocument] = []
        for ats, token, human in detect_boards(list(linked_from))[: self._max_boards]:
            url = api_url(ats, token)
            try:
                data = await self._fetcher.fetch_json(ctx, url)
            except FetchError:
                continue
            except BudgetExhausted:
                ctx.warn("budget_exhausted:max_pages")
                break
            jobs = parse_board(ats, data)
            if not jobs:
                continue
            lines = [job_line(j) for j in jobs]
            doc = RawDocument(
                url=url,
                final_url=url,
                title=f"{query.company_name} open roles ({ats})",
                text="\n".join(lines)[:60_000],
                html_hash="sha256:" + __import__("hashlib").sha256(repr(jobs).encode()).hexdigest(),
                source_type=SourceType.JOBS_BOARD,
                collector=self.name,
                content_type="application/json",
                metadata={
                    "ats": ats,
                    "human_url": human,
                    "jobs": jobs,
                    "linked_from": linked_from.get(human),
                },
            )
            ctx.docs.add(doc)
            docs.append(doc)
        return docs
