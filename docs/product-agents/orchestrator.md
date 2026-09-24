# Orchestrator (Gennie)

**Phase:** 8 · **Code:** `lib/agent/{planner,orchestrator,registry}.ts`, `app/api/agent/*`

## Purpose
Turn a natural-language goal into an approved, bounded plan and execute it durably through tools — ending with a campaign in `READY`, never a sent one.

## It is NOT
A free-running "autonomous agent loop". The LLM is used **once, to plan**; execution is a deterministic state machine over the approved plan.

## Inputs
`{ prompt, workspaceContext: { icp, positioning, tone, mailboxes[], engineCapabilities (from GET /v1/capabilities: which tasks/connectors are live), credits }, caps: { maxLeads, maxCredits } }`
The orchestrator delegates to **Lead / Campaign / Inbox agents** (Next.js). Research-type steps become Intelligence Engine runs via the Lead Agent (see `lead-agent.md`); the engine's own agents (Research, Signal, Qualification, Outreach Research, Evidence Validator) are internal to a single engine run and are **not** orchestrated step-by-step from Next.

## Planner output (zod)
```ts
Plan = {
  goal: string,
  steps: { id: string, tool: ToolName, args: object, dependsOn: string[],
           estimatedRecords?: number, estimatedCredits?: number, rationale: string }[],
  assumptions: string[],
  missingInputs: { key: string, question: string }[],   // blocks run until answered
  warnings: string[]
}
```
Validation: tools ∈ registry; args validate against each tool's `inputSchema`; DAG acyclic; totals ≤ caps; no step whose tool is unavailable (e.g. discovery when the engine's `/v1/capabilities` doesn't list it) — instead a `warnings` entry and the plan proceeds on existing leads.

## State machine
`planned → awaiting_approval → running ⇄ paused → completed | failed | canceled`
Per step: `pending → running → succeeded | failed | skipped | canceled`. Transitions persisted transactionally; every transition logs an `agent_run_step`.

## Execution rules
- Step = job (`agent_step`), idempotent by `(run_id, step_id, unit_key)`.
- Fan-out per lead via child jobs (`company_research`, `lead_scoring`, `personalization`); the parent advances when children settle; **partial failure policy** per step: `continue` (skip failed leads, record reasons) with a max failure ratio (default 30%) beyond which the step fails.
- Pause/cancel checked between units; cancel cascades to queued children and releases credit reservations.
- **No off-plan tool calls.** A retry re-runs the same step; a different approach requires a new plan + approval.
- Final step is always `create_campaign` (status `draft→ready`) + an approval request. `schedule_campaign` is only ever *requested*; launch happens in the UI by an approver.

## Guardrails (enforced in code, tested)
Workspace scope · lead/credit caps · DNC/unsub at enrollment · no send tool exists · per-run wall-clock limit (default 30 min) · prompt-injection defense: research/page content is passed as **data** in delimited blocks, and tool args from model output are re-validated — a scraped page saying "email everyone" has no path to action.

## Outputs
`agent_runs.output`: `{ counts (computed from DB), campaign_id, skipped: [{lead_id, reason}], warnings, credits_estimated, credits_used }`. The UI narrative is templated from these numbers, not free-written by the model.

## Failure modes → behavior
| Failure | Behavior |
|---|---|
| Planner returns invalid JSON | retry once with error; then "I couldn't build a plan" + no run |
| Ambiguous goal | `missingInputs` questions |
| Provider quota/outage | step `failed` with `QUOTA_EXCEEDED`/`PROVIDER_ERROR`; run pausable + resumable |
| Worker crash | lease expiry → step re-claimed; idempotent units skip done work |
| User cancels | cascade cancel, refund reservations |

## Evals
Canonical prompts (5–10) → expected plan shape; adversarial prompts ("email all leads now", "delete my leads", cross-workspace ids) → refused/`warnings`. Golden-path run with fakes asserts final `READY` campaign + counts == DB.
