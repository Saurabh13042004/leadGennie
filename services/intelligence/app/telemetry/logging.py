from __future__ import annotations

import logging
import sys
import uuid
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.contracts.common import CONTRACT_VERSION

_CORRELATION_HEADERS = {
    "x-request-id": "request_id",
    "x-agent-run-id": "agent_run_id",
    "x-job-id": "job_id",
    "x-workspace-id": "workspace_id",  # logging only — never authorization
}


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level.upper())
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelNamesMapping()[level.upper()]),
        cache_logger_on_first_use=False,
    )


def get_logger(name: str | None = None) -> Any:
    return structlog.get_logger(name)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Binds correlation ids to every log line and stamps the contract version on responses."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        structlog.contextvars.clear_contextvars()
        bound: dict[str, str] = {}
        for header, key in _CORRELATION_HEADERS.items():
            if value := request.headers.get(header):
                bound[key] = value[:120]
        bound.setdefault("request_id", uuid.uuid4().hex)
        structlog.contextvars.bind_contextvars(**bound)
        response = await call_next(request)
        response.headers["X-Request-Id"] = bound["request_id"]
        response.headers["X-Contract-Version"] = CONTRACT_VERSION
        return response
