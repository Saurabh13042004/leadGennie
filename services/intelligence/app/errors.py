from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.contracts.common import ApiError, ErrEnvelope, ErrorCode
from app.telemetry.logging import get_logger

log = get_logger(__name__)

_STATUS: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION: 422,
    ErrorCode.UNAUTHENTICATED: 401,
    ErrorCode.NOT_FOUND: 404,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.QUOTA_EXCEEDED: 429,
    ErrorCode.PROVIDER_ERROR: 502,
    ErrorCode.BUDGET_EXCEEDED: 422,
    ErrorCode.TIMEOUT: 504,
    ErrorCode.UNAVAILABLE: 503,
    ErrorCode.INTERNAL: 500,
}

_RETRYABLE = {
    ErrorCode.RATE_LIMITED,
    ErrorCode.PROVIDER_ERROR,
    ErrorCode.TIMEOUT,
    ErrorCode.UNAVAILABLE,
    ErrorCode.INTERNAL,
}


class EngineError(Exception):
    """Typed error mapped once, at the edge, to the contract error envelope."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        details: Any | None = None,
        retryable: bool | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        self.retryable = code in _RETRYABLE if retryable is None else retryable

    @property
    def status(self) -> int:
        return _STATUS[self.code]

    def to_api_error(self) -> ApiError:
        return ApiError(code=self.code, message=self.message, details=self.details, retryable=self.retryable)


def error_response(err: EngineError) -> JSONResponse:
    return JSONResponse(
        status_code=err.status, content=ErrEnvelope(error=err.to_api_error()).model_dump(mode="json")
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(EngineError)
    async def _engine_error(_: Request, exc: EngineError) -> JSONResponse:
        return error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"path": ".".join(str(p) for p in e.get("loc", ()) if p != "body"), "message": e.get("msg", "")}
            for e in exc.errors()
        ]
        return error_response(EngineError(ErrorCode.VALIDATION, "Invalid request", details=details))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Routing-level errors (404 unknown path, 405 wrong method, ...) keep their HTTP status.
        code = (
            ErrorCode.NOT_FOUND
            if exc.status_code == 404
            else ErrorCode.VALIDATION
            if 400 <= exc.status_code < 500
            else ErrorCode.INTERNAL
        )
        err = EngineError(code, str(exc.detail))
        return JSONResponse(
            status_code=exc.status_code, content=ErrEnvelope(error=err.to_api_error()).model_dump(mode="json")
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internals to the caller; the request id in the logs is the handle.
        log.exception("unhandled_error", error=type(exc).__name__)
        return error_response(EngineError(ErrorCode.INTERNAL, "Internal error"))
