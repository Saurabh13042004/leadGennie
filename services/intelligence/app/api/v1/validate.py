from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.auth import require_auth
from app.container import Container
from app.contracts.common import ErrorCode
from app.contracts.validate import ValidateRequest, ValidateResponse
from app.errors import EngineError

router = APIRouter(prefix="/v1/evidence", dependencies=[Depends(require_auth)], tags=["evidence"])


@router.post("/validate", response_model=ValidateResponse)
async def validate_claims(body: ValidateRequest, c: Container = Depends(get_container)) -> ValidateResponse:
    if c.validate_claims is None:
        raise EngineError(ErrorCode.UNAVAILABLE, "Evidence validation is not available in this mode")
    return ValidateResponse(data=await c.validate_claims(body))
