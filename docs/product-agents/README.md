# Product Agents

The AI agents *inside* LeadGennie. Not to be confused with `docs/missions/` (briefs for the coding agent that builds this).

There are **two homes** for agents, split by responsibility:

```
                    Gennie Orchestrator            (Next.js)
        ┌────────────────┼────────────────┐
     Lead Agent      Campaign Agent     Inbox Agent    (Next.js — product logic, persistence, approvals)
        │
        ▼  HTTPS (signed)
  LEADGENNIE INTELLIGENCE ENGINE                       (Python — investigates the world)
   Research · Signal · Qualification · Outreach Research · Evidence Validator
```

| Agent | Lives in | Spec | Phase | LLM? | Mutates via |
|---|---|---|---|---|---|
| Orchestrator | Next.js | [orchestrator.md](orchestrator.md) | 8 | Planner only | agent_runs + job enqueue |
| **Lead Agent** | Next.js | [lead-agent.md](lead-agent.md) | 2B, 8 | No (delegates to engine) | domain services from validated engine results |
| Campaign Agent | Next.js | [campaign-agent.md](campaign-agent.md) | 3–4, 8 | Yes | `generate_email`, `create_campaign` |
| Inbox Agent | Next.js | [inbox-agent.md](inbox-agent.md) | 6 | Yes | `classify_reply`, `draft_reply` |
| Research Agent | Python | [research-agent](../intelligence-engine/agents/research-agent.md) | 2A (people: 8) | Yes (grounded) | returns result only |
| Signal Agent | Python | [signal-agent](../intelligence-engine/agents/signal-agent.md) | 2A | Yes | returns result only |
| Qualification Agent | Python | [qualification-agent](../intelligence-engine/agents/qualification-agent.md) | 2A | Attribute normalization only; **score is deterministic** | returns result only |
| Outreach Research Agent | Python | [outreach-research-agent](../intelligence-engine/agents/outreach-research-agent.md) | 2A | Yes | returns result only |
| Evidence Validator | Python | [evidence-validator](../intelligence-engine/agents/evidence-validator.md) | 2A | Entailment step only; mostly deterministic | returns verdicts only |

> **Keep it to ~9 agents total, 5 in the engine.** Complexity belongs in deterministic tools (collectors, extractors, scoring, validators), not in more autonomous agents — they get expensive and hard to debug.

**Division of labor:** the engine *investigates and verifies*; Next.js *decides, persists, approves and sends*. Engine agents never touch product tables or send anything.

## Principles common to all agents

1. **Explicit tools only.** An agent is a prompt + an allow-list of tools/collectors. No DB, no arbitrary network, no other workspace.
2. **Structured in, structured out.** Inputs assembled by app code; outputs schema-validated (zod in Next, pydantic in Python); invalid → retry once → fail visibly. Nothing partial is written.
3. **The LLM proposes, the app disposes.** Business rules (scoring math, compliance, limits, approvals, idempotency) live in code.
4. **Evidence or silence.** Facts require verified evidence; without it the agent says "unknown".
5. **Observable.** Every invocation is an `agent_run_step` (tool, duration, tokens, credits, status, error); engine `trace[]` is imported into the same table.
6. **Metered.** Every LLM/provider call appears in `usage_records` (engine returns `usage[]`; Next writes).
7. **Scoped.** `ctx = { workspaceId, userId, runId }` flows through every Next-side tool; tool args never carry authority from model output.
8. **Never sends.** Only the user (reply click) or an approved campaign's worker sends email.

## Standard execution contract (PLAN §13)

```json
{
  "run_id": "…", "step_id": "…", "agent": "lead", "tool": "research_company",
  "status": "completed | failed | canceled",
  "result": { /* tool-specific, validated */ },
  "usage": { "input_tokens": 1234, "output_tokens": 456, "credits": 2 },
  "error": null
}
```

## Prompt & schema location

Next-side: `lib/ai/prompts/<agent>/*.ts` (workspace-editable ones live in the Prompt Library), `lib/ai/schemas/<agent>.ts` (zod). Engine-side: `services/intelligence/app/llm/prompts/<agent>/v<N>.py` (versioned, code-owned). Every prompt change requires the agent's eval to be re-run and its results pasted in the PR.
