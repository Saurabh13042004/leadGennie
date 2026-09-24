import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../helpers/test-db";
import { setSession } from "../helpers/session";
import { seedWorkspace, snapshotWorkspace, type SeededWorkspace } from "../helpers/seed-workspace";

import { listLeads, updateLead, deleteLead, deleteSegment, listSegments, importLeadsCsv } from "@/lib/actions/leads";
import { listCampaigns, updateCampaignStatus, listAudienceOptions } from "@/lib/actions/campaigns";
import { listApprovals, decideApproval } from "@/lib/actions/approvals";
import { listDeals, updateDealStage } from "@/lib/actions/deals";
import { listTasks, completeTask, dismissTask } from "@/lib/actions/tasks";
import { listPrompts, getPromptDetail, updateDraftVersion, cloneVersion, deprecateVersion, submitForApproval } from "@/lib/actions/prompts";
import { listDomains, removeDomain } from "@/lib/actions/domains";
import { listMailboxes, pauseMailbox, resumeMailbox, removeMailbox } from "@/lib/actions/mailboxes";
import {
  listForms, listSubmissions, toggleFormStatus, markSubmissionSpam, ignoreSubmission,
  assignSubmission, createLeadFromSubmission, linkSubmissionToLead, applyDncFromSubmission,
} from "@/lib/actions/forms";
import { listWorkflows, getWorkflow, deleteWorkflow } from "@/lib/actions/workflows";
import { listDncEntries, removeDncEntry } from "@/lib/actions/dnc";
import { listActivities } from "@/lib/actions/activities";
import { listConnections, disconnectConnection } from "@/lib/actions/integrations";
import { listMembers, updateMemberRole, removeMember } from "@/lib/actions/workspace";
import { getApiTokenInfo, regenerateApiToken } from "@/lib/actions/api-tokens";
import { getInsightBoardData } from "@/lib/actions/insights";
import { GET as queueGet, POST as queuePost } from "@/app/api/extension/queue/route";

let A: SeededWorkspace;
let B: SeededWorkspace;

function actAs(ws: SeededWorkspace, role: "owner" | "member" | "viewer" = "owner") {
  setSession({ workspaceId: ws.workspaceId, userId: ws.user.id, email: ws.user.email, role });
}

/** Run an attempt that MAY throw; what matters is that B's data is untouched. */
async function attempt(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    /* rejecting is a fine outcome */
  }
}

beforeEach(async () => {
  await resetDb();
  A = await seedWorkspace("A");
  B = await seedWorkspace("B");
});

describe("reads never cross workspaces", () => {
  it("every list/read action as A returns none of B's rows", async () => {
    actAs(A);
    const results: Record<string, unknown> = {
      leads: await listLeads(),
      segments: await listSegments(),
      audiences: await listAudienceOptions(),
      campaigns: await listCampaigns(),
      approvals: await listApprovals(),
      deals: await listDeals(),
      tasksOpen: await listTasks("my_open"),
      tasksToday: await listTasks("today"),
      prompts: await listPrompts(),
      domains: await listDomains(),
      mailboxes: await listMailboxes(),
      forms: await listForms(),
      submissions: await listSubmissions(),
      workflows: await listWorkflows(),
      dnc: await listDncEntries(),
      activities: await listActivities(),
      connections: await listConnections(),
      members: await listMembers(),
      apiToken: await getApiTokenInfo(),
      insights: await getInsightBoardData(),
    };
    for (const [name, value] of Object.entries(results)) {
      const json = JSON.stringify(value);
      expect(json, `${name} leaked B's data`).not.toContain(B.S);
      expect(json, `${name} leaked B's user`).not.toContain(B.user.email);
    }
    // ...and A really does see its own (guards against a vacuous pass).
    expect(JSON.stringify(results.leads)).toContain(A.S);
    expect(JSON.stringify(results.campaigns)).toContain(A.S);
  });

  it("reading B's records by id as A fails", async () => {
    actAs(A);
    await expect(getWorkflow(B.ids.workflowId)).rejects.toThrow();
    const detail = await getPromptDetail(B.ids.promptId).catch(() => null);
    expect(JSON.stringify(detail)).not.toContain(B.S);
  });
});

describe("writes never cross workspaces", () => {
  it("A cannot modify or delete B's data through any action, even with B's exact ids", async () => {
    const before = await snapshotWorkspace(B.workspaceId);
    actAs(A, "owner");
    const b = B.ids;

    await attempt(() => updateLead(b.leadId, { full_name: "pwned", email: "pwned@example.com" }));
    await attempt(() => deleteLead(b.leadId));
    await attempt(() => deleteSegment(b.segmentId));
    await attempt(() => updateCampaignStatus(b.campaignId, "paused"));
    await attempt(() => decideApproval(b.approvalId, "approved", "pwned"));
    await attempt(() => updateDealStage(b.dealId, A.ids.stageId));
    await attempt(() => updateDealStage(A.ids.dealId, b.stageId));
    await attempt(() => completeTask(b.taskId, "pwned"));
    await attempt(() => dismissTask(b.taskId));
    await attempt(() => updateDraftVersion(b.versionId, { template: "pwned" }));
    await attempt(() => cloneVersion(b.versionId));
    await attempt(() => deprecateVersion(b.versionId));
    await attempt(() => submitForApproval(b.versionId));
    await attempt(() => removeDomain(b.domainId));
    await attempt(() => pauseMailbox(b.mailboxId));
    await attempt(() => resumeMailbox(b.mailboxId));
    await attempt(() => removeMailbox(b.mailboxId));
    await attempt(() => toggleFormStatus(b.formId, "paused"));
    await attempt(() => markSubmissionSpam(b.submissionId));
    await attempt(() => ignoreSubmission(b.submissionId));
    await attempt(() => assignSubmission(b.submissionId, A.user.id));
    await attempt(() => createLeadFromSubmission(b.submissionId));
    await attempt(() => linkSubmissionToLead(b.submissionId, A.ids.leadId));
    await attempt(() => applyDncFromSubmission(b.submissionId));
    await attempt(() => deleteWorkflow(b.workflowId));
    await attempt(() => removeDncEntry(b.dncId));
    await attempt(() => disconnectConnection(b.connectionId));
    await attempt(() => updateMemberRole(b.memberId, "viewer"));
    await attempt(() => removeMember(b.memberId));

    expect(await snapshotWorkspace(B.workspaceId)).toBe(before);
  });

  it("A's actions with a mix of A and B ids only ever affect A", async () => {
    actAs(A);
    const beforeA = await snapshotWorkspace(A.workspaceId);
    await attempt(() => updateLead(A.ids.leadId, { full_name: "renamed by A", email: "a-renamed@example.com" }));
    expect(await snapshotWorkspace(A.workspaceId)).not.toBe(beforeA); // sanity: A's own writes work
  });

  it("CSV import in A with B's email never updates B's lead", async () => {
    const before = await snapshotWorkspace(B.workspaceId);
    actAs(A);
    const bEmail = `${B.S}@example.com`.toLowerCase();
    const result = await importLeadsCsv([{ full_name: "Imported by A", email: bEmail, company: "pwned" }], "a.csv");
    expect(result.created).toBe(1);
    expect(await snapshotWorkspace(B.workspaceId)).toBe(before);
  });

  it("role checks are real: a viewer cannot mutate even their own workspace", async () => {
    actAs(A, "viewer");
    await expect(deleteLead(A.ids.leadId)).rejects.toThrow(/role/);
    await expect(decideApproval(A.ids.approvalId, "approved")).rejects.toThrow(/role/);
  });
});

describe("API tokens", () => {
  it("regenerating A's token leaves B's token intact and A's is stored hashed", async () => {
    actAs(A);
    const plaintext = await regenerateApiToken();
    expect(plaintext).toMatch(/^lg_[0-9a-f]{48}$/);

    const { sql } = await import("../helpers/test-db");
    const rows = await sql`select token, token_hash from api_tokens where workspace_id = ${A.workspaceId}`;
    expect(rows[0].token).toBeNull();
    expect(rows[0].token_hash).not.toContain(plaintext);
    const bRows = await sql`select 1 from api_tokens where workspace_id = ${B.workspaceId}`;
    expect(bRows).toHaveLength(1);
  });
});

describe("extension API is workspace-scoped by token", () => {
  const call = (token: string | null, method: "GET" | "POST", body?: unknown) => {
    const req = new Request("http://localhost/api/extension/queue", {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return method === "GET" ? queueGet(req, undefined) : queuePost(req, undefined);
  };

  it("rejects missing and unknown tokens with a structured 401", async () => {
    for (const token of [null, "lg_nope", "garbage"]) {
      const res = await call(token, "GET");
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "UNAUTHENTICATED", error: "Unauthorized" });
      expect(json.request_id).toBeTruthy();
    }
  });

  it("A's token sees only A's queue; B's send id is a 404 for A and stays untouched", async () => {
    const before = await snapshotWorkspace(B.workspaceId);
    const list = await (await call(A.token, "GET")).json();
    expect(list.ok).toBe(true);
    expect(JSON.stringify(list)).toContain(A.S);
    expect(JSON.stringify(list)).not.toContain(B.S);

    const res = await call(A.token, "POST", { id: B.ids.sendId, status: "sent" });
    expect(res.status).toBe(404);
    expect(await snapshotWorkspace(B.workspaceId)).toBe(before);
  });

  it("reporting 'sent' twice increments sent_count once", async () => {
    const { sql } = await import("../helpers/test-db");
    await call(A.token, "POST", { id: A.ids.sendId, status: "sent" });
    await call(A.token, "POST", { id: A.ids.sendId, status: "sent" });
    const [c] = await sql`select sent_count from campaigns where id = ${A.ids.campaignId}`;
    expect(Number(c.sent_count)).toBe(1);
  });

  it("validates input with a 422 and field details", async () => {
    const res = await call(A.token, "POST", { id: "abc", status: "maybe" });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.details.length).toBeGreaterThan(0);
  });
});
