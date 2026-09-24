from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_container
from app.auth import require_auth
from app.container import Container
from app.contracts.capabilities import Capabilities, CapabilitiesResponse, ConnectorStatus, TaskCost
from app.contracts.common import RunTask

router = APIRouter(prefix="/v1", dependencies=[Depends(require_auth)], tags=["capabilities"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def capabilities(c: Container = Depends(get_container)) -> CapabilitiesResponse:
    """What is actually available right now. The Next.js planner shapes plans from this — nothing is assumed."""
    return CapabilitiesResponse(
        data=Capabilities(
            fake_mode=c.settings.engine_fake_mode,
            tasks=[RunTask.COMPANY_RESEARCH, RunTask.LEAD_RESEARCH, RunTask.FIND_SIGNALS],
            connectors=[ConnectorStatus.model_validate(x) for x in (c.connectors or [])],
            task_costs=[
                TaskCost(
                    task=RunTask.COMPANY_RESEARCH,
                    typical_llm_calls=8,
                    typical_pages=12,
                    typical_cost_usd=0.12,
                ),
                TaskCost(
                    task=RunTask.LEAD_RESEARCH, typical_llm_calls=10, typical_pages=14, typical_cost_usd=0.16
                ),
                TaskCost(
                    task=RunTask.FIND_SIGNALS, typical_llm_calls=5, typical_pages=8, typical_cost_usd=0.07
                ),
            ],
            llm_model=c.llm_model,
        )
    )
