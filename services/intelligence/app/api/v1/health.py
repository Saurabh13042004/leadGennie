from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_container
from app.container import Container
from app.contracts.capabilities import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    return HealthResponse()


@router.get("/readyz", response_model=HealthResponse)
async def readyz(c: Container = Depends(get_container)) -> JSONResponse:
    checks: dict[str, str] = {"store": "ok" if await c.store.ping() else "down"}
    s = c.settings
    if not s.engine_fake_mode:
        checks["llm"] = "ok" if s.openai_api_key else "missing OPENAI_API_KEY"
        checks["search"] = (
            "ok"
            if s.search_provider != "none" and s.brave_api_key
            else "no search provider (website+jobs only)"
        )
    hard = [k for k in ("store", "llm") if k in checks and checks[k] not in ("ok",)]
    ready = not hard
    body = HealthResponse(status="ok" if ready else "degraded", checks=checks)
    return JSONResponse(status_code=200 if ready else 503, content=body.model_dump())
