"""End-to-end harness: a fake internet (fixture sites + Greenhouse board), a fake search provider, and a
scripted LLM that answers by parsing the prompts it receives (so it stays valid if document order changes)."""

from __future__ import annotations

import re
from typing import Any

import httpx
from app.config import Settings
from app.contracts.common import SignalType
from app.fake.pipeline import FakePipeline  # noqa: F401
from app.llm.fake import FakeLlm
from app.pipeline.context import PipelineContext
from app.pipeline.research import ResearchPipeline
from app.sources.fetch import Fetcher
from app.sources.jobs import api_url
from app.sources.search import NullSearch, SearchHit
from app.store.memory import MemoryHostLimiter, MemorySourceCache

from tests.helpers import FakeResolver, fixture, html, make_settings, site_transport
from tests.judges import honest

BOARD = {
    "jobs": [
        {
            "title": "Sales Development Representative",
            "location": {"name": "Bengaluru"},
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
        },
        {
            "title": "Sales Development Representative",
            "location": {"name": "Austin"},
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
        },
        {
            "title": "Account Executive",
            "location": {"name": "Austin"},
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/3",
        },
    ]
}


def acme_routes() -> dict[str, httpx.Response]:
    return {
        "https://acme.example/robots.txt": httpx.Response(404),
        "https://acme.example/": html(fixture("acme_home.html")),
        "https://acme.example/about": html(fixture("acme_about.html")),
        "https://acme.example/careers": html(fixture("acme_careers.html")),
        "https://acme.example/news": html(
            "<main><h1>Newsroom</h1><p>Latest updates from the Acme newsroom appear here.</p></main>"
        ),
        api_url("greenhouse", "acme"): httpx.Response(200, json=BOARD),
        "https://www.prnewswire.com/robots.txt": httpx.Response(404),
        "https://www.prnewswire.com/acme-us": html(fixture("acme_news.html")),
    }


class FakeSearch(NullSearch):
    name, available = "fake", True

    def __init__(self, news_hits: list[SearchHit] | None = None) -> None:
        self._news = (
            news_hits
            if news_hits is not None
            else [SearchHit("https://www.prnewswire.com/acme-us", "Acme opens US office", "")]
        )

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        ctx.budget.spend_search()
        return []

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        ctx.budget.spend_search()
        return list(self._news)


def _doc_index(user: str) -> dict[str, int]:
    return {m.group(2): int(m.group(1)) for m in re.finditer(r'<document index="(\d+)" url="([^"]+)"', user)}


def extraction_handler(_system: str, user: str) -> dict[str, Any]:
    idx = _doc_index(user)
    find = lambda part: next((i for u, i in idx.items() if part in u), None)  # noqa: E731
    facts: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    people: list[dict[str, Any]] = []
    if (i := find("acme.example/about")) is not None:
        facts.append(
            {
                "doc": i,
                "field": "employee_count",
                "value": "120",
                "span": "We are a team of 120 people across Bengaluru and Austin.",
            }
        )
        people.append({"doc": i, "name": "Sarah Chen", "title": "VP Sales", "span": "Sarah Chen, VP Sales"})
    home = next((i for u, i in idx.items() if u == "https://acme.example/"), None)
    if home is not None:
        facts += [
            {
                "doc": home,
                "field": "industry",
                "value": "B2B SaaS",
                "span": "Acme is a B2B SaaS platform for outbound sales teams",
            },
            {
                "doc": home,
                "field": "description",
                "value": "helps SDR teams book meetings",
                "span": "Acme helps SDR teams book more qualified meetings with automated research and personalization.",
            },
            {
                "doc": home,
                "field": "location",
                "value": "Bengaluru, India",
                "span": "headquartered in Bengaluru, India",
            },
        ]
    if (i := find("prnewswire")) is not None:
        events += [
            {
                "doc": i,
                "kind": "expansion",
                "title": "US office",
                "description": "Opened first US office in Austin",
                "date": "September 12, 2026",
                "span": "Acme today announced the opening of its first US office in Austin, Texas",
            },
            {
                "doc": i,
                "kind": "funding",
                "title": "Series A",
                "description": "Raised a $12 million Series A led by Example Ventures",
                "date": None,
                "span": "The company also raised a $12 million Series A led by Example Ventures.",
            },
            {
                "doc": i,
                "kind": "funding",
                "title": "Series D",
                "description": "Raised a $500 million Series D",  # fabricated
                "date": None,
                "span": "The company raised a $500 million Series D led by Big Capital.",
            },
        ]
    return {"facts": facts, "events": events, "people": people, "jobs": []}


def synthesis_handler(_system: str, user: str) -> dict[str, Any]:
    ids = re.findall(r"\[(f_\d+)\] \(description\)", user)
    if not ids:
        return {}
    return {
        "description": {
            "text": "Acme helps SDR teams book more qualified meetings with automated research and personalization.",
            "fact_ids": ids,
        }
    }


def classify_handler(_system: str, user: str) -> dict[str, Any]:
    out = []
    for eid, rest in re.findall(r"\[(e_\d+)\] (.*)", user):
        stype = "EXPANSION" if "office" in rest.lower() else "FUNDING" if "raised" in rest.lower() else "NEWS"
        out.append({"event_id": eid, "relevant": True, "type": stype, "rationale": "stated"})
    return {"decisions": out}


def outreach_handler(_system: str, user: str) -> dict[str, Any]:
    rows = re.findall(r"\[(ev_\d+)\] (.*?) \| quote:", user)
    by = lambda needle: [eid for eid, claim in rows if needle in claim.lower()]  # noqa: E731
    hiring, expansion, person = by("open sales roles"), by("us office"), by("sarah chen")
    return {
        "why_contact": [],
        "why_now": [
            {
                "text": "Acme has open sales roles and opened its first US office in Austin.",
                "evidence_ids": hiring + expansion,
            }
        ]
        if hiring and expansion
        else [],
        "why_person": [{"text": "Sarah Chen is VP Sales at Acme.", "evidence_ids": person}] if person else [],
        "potential_problem": "Rapid sales hiring may strain pipeline efficiency.",
        "recommended_angle": "Lead with qualified pipeline per SDR rather than generic lead generation.",
        "angle_evidence_ids": hiring,
        "avoid": ["Do not mention funding rumors"],
    }


def scripted_llm() -> FakeLlm:
    return (
        FakeLlm()
        .on("extract", extraction_handler)
        .on("research_synthesis", synthesis_handler)
        .on("signal_classify", classify_handler)
        .on("entailment", honest)
        .on("outreach", outreach_handler)
        .on("normalize_attributes", {"industry": None, "country": None})
    )


def make_pipeline(
    routes: dict[str, httpx.Response] | None = None,
    *,
    llm: FakeLlm | None = None,
    search: Any = None,
    settings: Settings | None = None,
) -> tuple[ResearchPipeline, FakeLlm]:
    llm = llm or scripted_llm()
    s = settings or make_settings()
    client = httpx.AsyncClient(
        transport=site_transport(routes if routes is not None else acme_routes()), follow_redirects=False
    )
    fetcher = Fetcher(s, MemoryHostLimiter(), MemorySourceCache(), client=client, resolver=FakeResolver())
    return ResearchPipeline(s, fetcher, search if search is not None else FakeSearch(), llm), llm


ICP = {
    "industries": [{"value": "b2b_saas", "weight": 25}],
    "employee_range": {"min": 50, "max": 500, "weight": 20},
    "geographies": [{"value": "IN", "weight": 15}],
    "titles": [{"seniority": ["vp", "head", "cxo"], "function": ["sales"], "weight": 25}],
    "keyword_signals": [{"keyword": "outbound", "weight": 15}],
    "min_score_to_qualify": 70,
}
_ = SignalType
