.PHONY: dev fake verify lint typecheck test contract openapi smoke eval live migrate docker

PY := uv run

dev:            ## run the real engine on :8000 (needs .env)
	$(PY) uvicorn app.main:app_factory --factory --reload --port 8000

fake:           ## deterministic fake engine (no keys, no network) for developing the Next.js side
	ENGINE_FAKE_MODE=1 INTELLIGENCE_SERVICE_TOKEN=dev-token INTELLIGENCE_SIGNING_SECRET=dev-secret \
	  $(PY) uvicorn app.main:app_factory --factory --port 8000

lint:
	$(PY) ruff check .
	$(PY) ruff format --check .
	$(PY) lint-imports

typecheck:
	$(PY) mypy

test:
	$(PY) pytest

contract:       ## OpenAPI + golden-fixture drift checks, invariants on every fixture result
	$(PY) python scripts/export_openapi.py --check
	$(PY) python scripts/export_fixtures.py --check
	$(PY) pytest tests/contract -q

openapi:        ## regenerate the committed OpenAPI contract + golden fixtures the Next.js tests use
	$(PY) python scripts/export_openapi.py
	$(PY) python scripts/export_fixtures.py

verify: lint typecheck test contract   ## everything CI runs

migrate:        ## apply intel-schema migrations (privileged INTEL_DATABASE_URL)
	$(PY) python scripts/migrate.py

smoke:          ## budget-limited REAL run: make smoke DOMAIN=example.com NAME="Example"
	$(PY) python scripts/smoke.py $(DOMAIN) "$(NAME)"

eval:           ## adversarial validator + extraction evals (fake LLM) with metrics printed
	$(PY) pytest tests/evals -s -q

live:           ## tests that hit the real network/LLM (never in CI)
	$(PY) pytest -m live -s

docker:
	docker build -t leadgennie-intelligence .
