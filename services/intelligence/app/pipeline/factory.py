from __future__ import annotations

import contextlib
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from app.config import Settings
from app.contracts.common import RunTask
from app.contracts.result import Verification
from app.contracts.runs import RunRequest
from app.contracts.validate import ClaimCheck, ValidateData, ValidateRequest
from app.contracts.validate import ClaimVerdict as VerdictOut
from app.evidence.models import Claim, EvidenceRef
from app.evidence.validator import EvidenceValidator
from app.llm.client import LlmClient, OpenAiBackend, StructuredLlm
from app.pipeline.context import PipelineContext
from app.pipeline.research import ResearchPipeline
from app.pipeline.service import Executor
from app.sources.fetch import Fetcher, FetchError
from app.sources.registry import build_search
from app.sources.search import news_available, web_available
from app.store.base import Store


def make_validate_fn(
    settings: Settings, fetcher: Fetcher, llm: LlmClient
) -> Callable[[ValidateRequest], Awaitable[ValidateData]]:
    """Standalone claim validation (`POST /v1/evidence/validate`): re-fetch each source through the guarded
    fetcher, then run the same Evidence Validator the pipeline uses."""

    async def validate_claims(req: ValidateRequest) -> ValidateData:
        ctx = PipelineContext(
            "validate",
            RunRequest.model_validate(
                {
                    "idempotency_key": "validate-adhoc",
                    "task": RunTask.COMPANY_RESEARCH.value,
                    "input": {"company": {"name": req.claims[0].company_name}},
                }
            ),
        )
        if req.refetch:
            for c in req.claims:
                # if it can't be fetched the URL stays "not fetched" and the claim cannot verify
                with contextlib.suppress(FetchError):
                    await fetcher.fetch_page(ctx, c.source_url, max_age_seconds=86400)
        validator = EvidenceValidator(ctx.docs, llm, settings)
        claims = [
            Claim(
                id=c.id,
                text=c.claim,
                type="signal" if c.signal_type else "profile_field",
                refs=[EvidenceRef(c.source_url, c.snippet)],
                company_name=c.company_name,
                company_domain=c.company_domain,
                signal_type=c.signal_type,
            )
            for c in req.claims
        ]
        out: list[VerdictOut] = []
        for v in await validator.validate(ctx, claims):
            checks = [*v.checks, *[chk for r in v.refs for chk in r.checks]]
            out.append(
                VerdictOut(
                    id=v.claim.id,
                    narrowed_claim=v.narrowed_claim,
                    verdict=Verification(
                        verified=v.verified,
                        confidence=v.confidence,
                        method=v.methods,
                        checked_at=datetime.now(UTC),
                        notes=v.notes,
                    ),
                    checks=[
                        ClaimCheck(name=c.name, passed=c.passed, hard=c.hard, note=c.note) for c in checks
                    ],
                )
            )
        return ValidateData(verdicts=out)

    return validate_claims


def build_real_pipeline(
    settings: Settings, store: Store
) -> tuple[Executor, str | None, list[dict[str, Any]], Callable[[ValidateRequest], Awaitable[ValidateData]]]:
    """Wire the real object graph (DIP: every collaborator is injected, so tests build their own)."""
    llm = StructuredLlm(OpenAiBackend(settings))
    fetcher = Fetcher(settings, store.limiter, store.cache)
    search = build_search(settings)
    pipeline = ResearchPipeline(settings, fetcher, search, llm)
    connectors = [
        {"name": "website", "available": True},
        {"name": "jobs", "available": True},
        {
            "name": "web_search",
            "available": web_available(search),
            "reason": None if web_available(search) else "SEARCH_PROVIDER not configured",
        },
        {
            "name": "news",
            "available": news_available(search),
            "reason": None if news_available(search) else "SEARCH_PROVIDER / NEWS_FALLBACK not configured",
        },
        {
            "name": "llm",
            "available": bool(settings.openai_api_key),
            "reason": None if settings.openai_api_key else "OPENAI_API_KEY not set",
        },
    ]

    return pipeline, settings.openai_model, connectors, make_validate_fn(settings, fetcher, llm)
