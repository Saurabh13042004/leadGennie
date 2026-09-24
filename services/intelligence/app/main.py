from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import capabilities, health, runs, score, validate
from app.config import Settings, get_settings
from app.container import Container, build_container
from app.contracts.common import CONTRACT_VERSION
from app.errors import install_error_handlers
from app.telemetry.logging import RequestContextMiddleware, configure_logging, get_logger

log = get_logger(__name__)


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        c = container or await build_container(settings)
        app.state.container = c
        resumed = await c.runs.recover()
        log.info("engine_started", fake_mode=settings.engine_fake_mode, resumed_runs=resumed)
        try:
            yield
        finally:
            await c.runs.shutdown()
            await c.store.close()

    app = FastAPI(
        title="LeadGennie Intelligence Engine",
        version=CONTRACT_VERSION,
        description="Private service: investigates the public web, verifies evidence, scores fit.",
        lifespan=lifespan,
    )
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)
    for module in (health, runs, score, validate, capabilities):
        app.include_router(module.router)
    return app


def app_factory() -> FastAPI:  # uvicorn --factory app.main:app_factory
    return create_app()
