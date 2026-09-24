import json

import pytest
from app.contracts.common import ErrorCode
from app.errors import EngineError
from app.llm.client import RawCompletion, StructuredLlm, estimate_cost
from app.llm.fake import FakeLlm
from app.llm.schema import to_strict_schema
from app.pipeline.context import BudgetExhausted
from pydantic import BaseModel

from tests.helpers import make_ctx


class Item(BaseModel):
    title: str
    default: str | None = None
    count: int = 0


class Out(BaseModel):
    items: list[Item]
    note: str | None = None


def test_strict_schema_keeps_property_names_that_look_like_keywords() -> None:
    s = to_strict_schema(Out.model_json_schema())
    item = s["properties"]["items"]["items"]
    assert set(item["properties"]) == {"title", "default", "count"}
    assert item["required"] == ["title", "default", "count"] and item["additionalProperties"] is False
    assert s["required"] == ["items", "note"] and "$defs" not in json.dumps(s) and "$ref" not in json.dumps(s)
    assert "default" not in item["properties"]["count"]  # the *keyword* is dropped, the *field* is kept


class ScriptedBackend:
    provider, model = "test", "gpt-4o"

    def __init__(self, *texts: str | Exception) -> None:
        self.texts, self.prompts = list(texts), []

    async def complete_json(self, **kw):  # type: ignore[no-untyped-def]
        self.prompts.append(kw["user"])
        item = self.texts.pop(0)
        if isinstance(item, Exception):
            raise item
        return RawCompletion(item, 1000, 200)


async def test_valid_output_parses_and_records_usage_and_trace() -> None:
    ctx = make_ctx()
    llm = StructuredLlm(ScriptedBackend('{"items":[{"title":"a","default":null,"count":1}],"note":null}'))
    out = await llm.generate(ctx, task="t", system="s", user="u", schema=Out)
    assert out.items[0].title == "a"
    assert ctx.usage[0].tokens_in == 1000 and ctx.usage[0].cost_estimate == pytest.approx(
        estimate_cost("gpt-4o", 1000, 200)
    )
    assert ctx.trace[0].tool == "t" and ctx.budget.llm_calls == 1


async def test_invalid_output_is_retried_once_with_the_error_then_succeeds() -> None:
    backend = ScriptedBackend("not json", '{"items":[],"note":null}')
    out = await StructuredLlm(backend).generate(make_ctx(), task="t", system="s", user="u", schema=Out)
    assert out.items == [] and len(backend.prompts) == 2 and "failed validation" in backend.prompts[1]


async def test_two_invalid_outputs_fail_visibly_and_never_return_partial_data() -> None:
    with pytest.raises(EngineError) as exc:
        await StructuredLlm(ScriptedBackend('{"items": 5}', "{}")).generate(
            make_ctx(), task="t", system="s", user="u", schema=Out
        )
    assert exc.value.code == ErrorCode.PROVIDER_ERROR and exc.value.retryable


async def test_llm_call_budget_is_checked_before_the_call() -> None:
    backend = ScriptedBackend('{"items":[],"note":null}', '{"items":[],"note":null}')
    llm, ctx = StructuredLlm(backend), make_ctx(max_llm_calls=1)
    await llm.generate(ctx, task="t", system="s", user="u", schema=Out)
    with pytest.raises(BudgetExhausted):
        await llm.generate(ctx, task="t", system="s", user="u", schema=Out)
    assert len(backend.prompts) == 1  # the second call never left the process


async def test_provider_errors_pass_through_with_contract_codes() -> None:
    err = EngineError(ErrorCode.QUOTA_EXCEEDED, "quota", retryable=False)
    with pytest.raises(EngineError) as exc:
        await StructuredLlm(ScriptedBackend(err)).generate(
            make_ctx(), task="t", system="s", user="u", schema=Out
        )
    assert exc.value.code == ErrorCode.QUOTA_EXCEEDED


async def test_fake_llm_validates_dicts_and_records_calls() -> None:
    fake = FakeLlm().on("t", {"items": [{"title": "x"}]})
    out = await fake.generate(make_ctx(), task="t", system="S", user="U", schema=Out)
    assert out.items[0].count == 0 and fake.calls_for("t") == [("S", "U")]
    with pytest.raises(AssertionError):
        await fake.generate(make_ctx(), task="unknown", system="", user="", schema=Out)
