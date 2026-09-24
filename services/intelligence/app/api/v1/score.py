from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import require_auth
from app.contracts.score import ScoreRequest, ScoreResponse
from app.scoring.engine import score

router = APIRouter(prefix="/v1", dependencies=[Depends(require_auth)], tags=["score"])


@router.post("/score", response_model=ScoreResponse)
async def score_endpoint(body: ScoreRequest) -> ScoreResponse:
    """Pure, synchronous ICP/intent scoring: no network, no LLM. Unverified signals are ignored."""
    return ScoreResponse(data=score(body))
