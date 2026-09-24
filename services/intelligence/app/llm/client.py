"""The ONLY place the engine talks to an LLM. Structured output, retry-once-on-validation-failure, usage +
cost accounting, quota mapping, budget checks before every call. Agents depend on the `LlmClient` protocol
(DIP), so tests inject `FakeLlm`."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.contracts.common import ErrorCode, UsageItem
from app.errors import EngineError
from app.llm.schema import to_strict_schema
from app.pipeline.context import PipelineContext
from app.telemetry.logging import get_logger

log = get_logger(__name__)
T = TypeVar("T", bound=BaseModel)

# USD per 1M tokens (input, output). Estimates for budgets/credits; refine from real invoices.
_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
}
_DEFAULT_PRICING = (2.50, 10.00)


def estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    pin, pout = _PRICING.get(model, _DEFAULT_PRICING)
    return (tokens_in * pin + tokens_out * pout) / 1_000_000


@dataclass
class RawCompletion:
    text: str
    tokens_in: int
    tokens_out: int


class LlmBackend(Protocol):
    provider: str
    model: str

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        model: str | None,
        temperature: float,
    ) -> RawCompletion: ...


class LlmClient(Protocol):
    model: str

    async def generate(
        self,
        ctx: PipelineContext,
        *,
        task: str,
        system: str,
        user: str,
        schema: type[T],
        model: str | None = None,
    ) -> T: ...


class OpenAiBackend:
    provider = "openai"

    def __init__(self, settings: Settings, client: AsyncOpenAI | None = None) -> None:
        self.model = settings.openai_model
        self._client = client or AsyncOpenAI(
            api_key=settings.openai_api_key or "unset", timeout=60.0, max_retries=1
        )
        self._configured = bool(settings.openai_api_key) or client is not None

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        model: str | None,
        temperature: float,
    ) -> RawCompletion:
        if not self._configured:
            raise EngineError(ErrorCode.UNAVAILABLE, "OPENAI_API_KEY is not set", retryable=False)
        try:
            resp = await self._client.chat.completions.create(
                model=model or self.model,
                temperature=temperature,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": schema_name, "strict": True, "schema": schema},
                },
            )
        except RateLimitError as exc:
            if getattr(exc, "code", None) == "insufficient_quota":
                raise EngineError(
                    ErrorCode.QUOTA_EXCEEDED,
                    "OpenAI API quota exceeded — check billing/usage limits",
                    retryable=False,
                ) from exc
            raise EngineError(ErrorCode.RATE_LIMITED, "OpenAI rate limit reached") from exc
        except APITimeoutError as exc:
            raise EngineError(ErrorCode.TIMEOUT, "OpenAI request timed out") from exc
        except APIConnectionError as exc:
            raise EngineError(ErrorCode.PROVIDER_ERROR, "Could not reach OpenAI") from exc
        except APIStatusError as exc:
            if exc.status_code in (401, 403):
                raise EngineError(
                    ErrorCode.PROVIDER_ERROR, "OpenAI rejected the API key", retryable=False
                ) from exc
            raise EngineError(ErrorCode.PROVIDER_ERROR, f"OpenAI error {exc.status_code}") from exc
        msg = resp.choices[0].message
        if getattr(msg, "refusal", None):
            raise EngineError(ErrorCode.PROVIDER_ERROR, "The model declined the request", retryable=False)
        usage = resp.usage
        return RawCompletion(
            msg.content or "", usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0
        )


class StructuredLlm:
    """Adds validation, one retry, budget checks and usage accounting on top of any `LlmBackend`."""

    def __init__(self, backend: LlmBackend) -> None:
        self._backend = backend
        self.model = backend.model

    async def generate(
        self,
        ctx: PipelineContext,
        *,
        task: str,
        system: str,
        user: str,
        schema: type[T],
        model: str | None = None,
    ) -> T:
        strict = to_strict_schema(schema.model_json_schema())
        used_model = model or self._backend.model
        last_error: str | None = None
        for attempt in (1, 2):
            ctx.check_cancelled()
            ctx.budget.spend_llm()  # hard budget: checked BEFORE the call
            prompt = (
                user
                if last_error is None
                else (
                    f"{user}\n\nYour previous answer failed validation: {last_error}\nReturn ONLY valid JSON matching the schema."
                )
            )
            async with ctx.step("llm", tool=task, input_summary=f"{task} (attempt {attempt})") as out:
                raw = await self._backend.complete_json(
                    system=system,
                    user=prompt,
                    schema_name=schema.__name__[:60],
                    schema=strict,
                    model=model,
                    temperature=0.0,
                )
                ctx.add_usage(
                    UsageItem(
                        kind="llm",
                        provider=self._backend.provider,
                        model=used_model,
                        units=1,
                        tokens_in=raw.tokens_in,
                        tokens_out=raw.tokens_out,
                        cost_estimate=estimate_cost(used_model, raw.tokens_in, raw.tokens_out),
                    )
                )
                out["tokens_in"], out["tokens_out"] = raw.tokens_in, raw.tokens_out
                try:
                    parsed = schema.model_validate_json(raw.text)
                except (ValidationError, json.JSONDecodeError) as exc:
                    last_error = str(exc)[:400]
                    out["output_summary"] = "validation_failed"
                    log.warning("llm_output_invalid", task=task, attempt=attempt)
                    parsed = None
                else:
                    out["output_summary"] = "ok"
            if parsed is not None:
                return parsed
        raise EngineError(
            ErrorCode.PROVIDER_ERROR,
            f"Model output failed validation for {task}",
            retryable=True,
            details=last_error,
        )
