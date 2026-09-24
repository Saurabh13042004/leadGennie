"""Architectural boundaries the engine must never cross (docs/intelligence-engine/README.md, rules X1/X2/X12)."""

import ast
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"

MAIL_LIBS = {
    "smtplib",
    "resend",
    "sendgrid",
    "mailgun",
    "postmarker",
    "smtpd",
    "aiosmtplib",
    "yagmail",
    "mailchimp_transactional",
}


def python_files() -> list[Path]:
    return [p for p in APP.rglob("*.py")]


def test_the_engine_has_no_way_to_send_email() -> None:
    """X2: the engine only reads the public web and returns data."""
    imports: set[str] = set()
    for p in python_files():
        for line in p.read_text().splitlines():
            m = re.match(r"\s*(?:from|import)\s+([A-Za-z_][\w]*)", line)
            if m:
                imports.add(m.group(1).lower())
    assert imports.isdisjoint(MAIL_LIBS), imports & MAIL_LIBS
    deps = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["dependencies"]
    assert not [d for d in deps if any(lib in d.lower() for lib in MAIL_LIBS)]


def _sql_strings() -> list[tuple[str, str]]:
    """Every string in the store module that is actually SQL, plus the migration files."""
    out: list[tuple[str, str]] = []
    tree = ast.parse((APP / "store" / "postgres.py").read_text())
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and re.search(r"^\s*(select|insert|update|delete|with|create|drop|alter)\b", node.value, re.I)
        ):
            out.append(("postgres.py", node.value))
    out += [(p.name, p.read_text()) for p in sorted((ROOT / "migrations").glob("*.sql"))]
    return out


TABLE_REF = re.compile(
    r"\b(?:from|into|update|join|delete from|create table if not exists|create table)\s+([a-z_][\w.]*)", re.I
)


def test_all_sql_touches_only_the_intel_schema() -> None:
    """X1: the engine never reads or writes product tables — every table reference is `intel.<table>`."""
    strings = _sql_strings()
    assert strings, "no SQL found — the scan itself is broken"
    offenders = []
    for source, sql in strings:
        for m in TABLE_REF.finditer(sql):
            table = m.group(1).lower()
            # `claimed` is a CTE name in the limiter query; `set` follows `do update` in an upsert
            if table.startswith("intel.") or table in {"claimed", "set"}:
                continue
            offenders.append(f"{source}: {m.group(0)}")
    assert offenders == [], offenders


def test_capabilities_expose_only_read_tasks() -> None:
    """X12/X2: tasks are research (read) tasks; nothing that acts on the outside world."""
    from app.contracts.common import RunTask

    assert {t.value for t in RunTask} == {"company_research", "lead_research", "find_signals"}


def test_at_most_five_engine_agents() -> None:
    """X12: Research, Signal, Qualification, Outreach Research (agents/) + the Evidence Validator (evidence/)."""
    agents = {p.stem for p in (APP / "agents").glob("*.py") if p.stem != "__init__"}
    assert agents == {"research", "signal", "qualification", "outreach"}
    assert (APP / "evidence" / "validator.py").exists()


def test_llm_sdk_is_only_used_in_the_llm_client() -> None:
    """Rule: LLM calls go through llm/client.py — no other module imports the vendor SDK."""
    offenders = [
        p.relative_to(APP).as_posix()
        for p in python_files()
        if re.search(r"^\s*(?:from|import)\s+openai\b", p.read_text(), re.M)
        and p.relative_to(APP).as_posix() != "llm/client.py"
    ]
    assert offenders == []
