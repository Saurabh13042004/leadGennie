"""Pydantic JSON Schema -> OpenAI strict structured-output schema.

Strict mode requires: every object has `additionalProperties: false` and lists ALL properties as required
(optional fields become nullable), no `default`, and `$ref`s resolvable. We inline `$defs` so the schema is
self-contained and predictable."""

from __future__ import annotations

from typing import Any

_DROP = {
    "default",
    "title",
    "examples",
    "$schema",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minItems",
    "maxItems",
    "pattern",
    "format",
}


def _inline(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, dict):
        if "$ref" in node:
            name = node["$ref"].split("/")[-1]
            return _inline(defs[name], defs)
        return {k: _inline(v, defs) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline(v, defs) for v in node]
    return node


def _strictify(node: Any) -> Any:
    if isinstance(node, list):
        return [_strictify(v) for v in node]
    if not isinstance(node, dict):
        return node
    out: dict[str, Any] = {}
    for key, value in node.items():
        if key == "properties" and isinstance(value, dict):
            # keys here are PROPERTY NAMES (a field called "title" or "default" must survive)
            out[key] = {name: _strictify(sub) for name, sub in value.items()}
        elif key not in _DROP:
            out[key] = _strictify(value)
    if out.get("type") == "object" or "properties" in out:
        props = out.get("properties", {})
        required = set(out.get("required", []))
        for name, sub in list(props.items()):
            if name not in required:
                props[name] = _nullable(sub)
        out["properties"] = props
        out["required"] = list(props)
        out["additionalProperties"] = False
    return out


def _nullable(sub: dict[str, Any]) -> dict[str, Any]:
    t = sub.get("type")
    if isinstance(t, str):
        return {**sub, "type": [t, "null"]}
    if isinstance(t, list):
        return sub if "null" in t else {**sub, "type": [*t, "null"]}
    if "anyOf" in sub:
        variants = sub["anyOf"]
        return (
            sub
            if any(v.get("type") == "null" for v in variants)
            else {**sub, "anyOf": [*variants, {"type": "null"}]}
        )
    return {"anyOf": [sub, {"type": "null"}]}


def to_strict_schema(schema: dict[str, Any]) -> dict[str, Any]:
    defs = schema.get("$defs", {})
    flat = _inline({k: v for k, v in schema.items()}, defs)
    result: dict[str, Any] = _strictify(flat)
    return result
