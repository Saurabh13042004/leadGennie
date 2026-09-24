from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_container
from app.auth import require_auth
from app.container import Container
from app.contracts.common import ErrorCode, RunStatus
from app.contracts.runs import RunCreated, RunCreatedResponse, RunRequest, RunViewResponse
from app.errors import EngineError

router = APIRouter(prefix="/v1/runs", dependencies=[Depends(require_auth)], tags=["runs"])


@router.post("", status_code=202, response_model=RunCreatedResponse)
async def create_run(body: RunRequest, c: Container = Depends(get_container)) -> RunCreatedResponse:
    rec = await c.runs.submit(body)
    return RunCreatedResponse(data=RunCreated(run_id=rec.run_id, status=RunStatus(rec.status)))


@router.get("/{run_id}", response_model=RunViewResponse)
async def get_run(run_id: str, c: Container = Depends(get_container)) -> RunViewResponse:
    view = await c.runs.view(run_id)
    if view is None:
        raise EngineError(ErrorCode.NOT_FOUND, "Run not found")
    return RunViewResponse(data=view)


@router.post("/{run_id}/cancel", response_model=RunViewResponse)
async def cancel_run(run_id: str, c: Container = Depends(get_container)) -> RunViewResponse:
    view = await c.runs.cancel(run_id)
    if view is None:
        raise EngineError(ErrorCode.NOT_FOUND, "Run not found")
    return RunViewResponse(data=view)


@router.get("/{run_id}/events")
async def run_events(run_id: str, c: Container = Depends(get_container)) -> StreamingResponse:
    """Optional Server-Sent Events progress stream (Next polls by default)."""
    if await c.runs.view(run_id) is None:
        raise EngineError(ErrorCode.NOT_FOUND, "Run not found")

    async def stream() -> AsyncIterator[str]:
        last: str | None = None
        while True:
            view = await c.runs.view(run_id)
            if view is None:
                return
            payload = json.dumps({"status": view.status.value, "progress": view.progress.model_dump()})
            if payload != last:
                yield f"event: progress\ndata: {payload}\n\n"
                last = payload
            if view.status.terminal:
                yield f"event: done\ndata: {json.dumps({'status': view.status.value})}\n\n"
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
