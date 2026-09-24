import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { setSession } from "../helpers/session";
import { createLead, createWorkspace } from "../helpers/factories";
import { createCampaign } from "@/lib/actions/campaigns";
import { decideApproval, listApprovals } from "@/lib/actions/approvals";

async function setup() {
  const { workspaceId, user } = await createWorkspace();
  setSession({ workspaceId, userId: user.id, email: user.email, role: "owner" });
  const [domain] = await sql`
    insert into domains (workspace_id, resend_domain_id, name, status) values (${workspaceId}, 'rd', 'x.example.com', 'verified') returning id`;
  const [mailbox] = await sql`
    insert into mailboxes (workspace_id, domain_id, email, status) values (${workspaceId}, ${domain.id}, 'from@x.example.com', 'active') returning id`;
  const ok1 = await createLead(workspaceId, { email: "ok1@example.com" });
  const ok2 = await createLead(workspaceId, { email: "ok2@example.com" });
  const blocked = await createLead(workspaceId, { email: "blocked@example.com" });
  await sql`insert into do_not_contact (workspace_id, email) values (${workspaceId}, 'blocked@example.com')`;
  return { workspaceId, user, mailboxId: Number(mailbox.id), leads: { ok1, ok2, blocked } };
}

const launch = (mailboxId: number) =>
  createCampaign({
    name: "Launch",
    audienceLabel: "All",
    audienceSegmentId: null,
    totalLeads: 3,
    channels: ["email"],
    mailboxId,
    dailyEmailLimit: 80,
    dailyDmLimit: 25,
    steps: [
      { channel: "email", waitDays: 0, subject: "s1", body: "b1" },
      { channel: "email", waitDays: 3, subject: "s2", body: "b2" },
    ],
  });

const count = async (q: PromiseLike<Record<string, unknown>[]>) => Number((await q)[0].n);

beforeEach(resetDb);

describe("campaign approval state machine", () => {
  it("creating a campaign schedules NOTHING — it waits in pending_approval, excluding suppressed leads", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    expect(res.status).toBe("pending_approval");
    expect(res.leadCount).toBe(2);
    expect(res.blockedCount).toBe(1);
    expect(await count(sql`select count(*) as n from campaign_sends where campaign_id = ${res.id}`)).toBe(0);
    const [c] = await sql`select status, approval_id from campaigns where id = ${res.id}`;
    expect(c.status).toBe("pending_approval");
    expect(String(c.approval_id)).toBe(String(res.approvalId));
  });

  it("approval schedules one send per (allowed lead × step) and starts the campaign", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    await decideApproval(res.approvalId, "approved", "lgtm");

    const [c] = await sql`select status, total_leads from campaigns where id = ${res.id}`;
    expect(c.status).toBe("running");
    expect(await count(sql`select count(*) as n from campaign_sends where campaign_id = ${res.id}`)).toBe(4); // 2 leads × 2 steps
    const leadIds = await sql`select distinct lead_id from campaign_sends where campaign_id = ${res.id}`;
    expect(leadIds.map((r) => String(r.lead_id)).sort()).toEqual([String(s.leads.ok1.id), String(s.leads.ok2.id)].sort());
    const [a] = await sql`select status, decided_by_user_id from approvals where id = ${res.approvalId}`;
    expect(a.status).toBe("approved");
    expect(Number(a.decided_by_user_id)).toBe(s.user.id);
  });

  it("re-checks compliance AT approval time: a lead suppressed after the request is dropped", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    await sql`insert into do_not_contact (workspace_id, email) values (${s.workspaceId}, 'ok2@example.com')`;
    await decideApproval(res.approvalId, "approved");
    const leadIds = await sql`select distinct lead_id from campaign_sends where campaign_id = ${res.id}`;
    expect(leadIds.map((r) => String(r.lead_id))).toEqual([String(s.leads.ok1.id)]);
  });

  it("rejection marks the campaign rejected and schedules nothing", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    await decideApproval(res.approvalId, "rejected", "not now");
    const [c] = await sql`select status from campaigns where id = ${res.id}`;
    expect(c.status).toBe("rejected");
    expect(await count(sql`select count(*) as n from campaign_sends where campaign_id = ${res.id}`)).toBe(0);
  });

  it("a decision is final — deciding twice fails and changes nothing", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    await decideApproval(res.approvalId, "approved");
    await expect(decideApproval(res.approvalId, "rejected")).rejects.toThrow(/already decided/);
    const [c] = await sql`select status from campaigns where id = ${res.id}`;
    expect(c.status).toBe("running");
  });

  it("only owner/admin can decide; a member cannot approve their own launch", async () => {
    const s = await setup();
    const res = await launch(s.mailboxId);
    setSession({ workspaceId: s.workspaceId, userId: s.user.id, email: s.user.email, role: "member" });
    await expect(decideApproval(res.approvalId, "approved")).rejects.toThrow(/admin/);
    const [a] = await sql`select status from approvals where id = ${res.approvalId}`;
    expect(a.status).toBe("pending");
    expect((await listApprovals("pending")).length).toBe(1);
  });

  it("refuses to launch from a mailbox that isn't active on a verified domain", async () => {
    const s = await setup();
    await sql`update domains set status = 'pending' where workspace_id = ${s.workspaceId}`;
    await expect(launch(s.mailboxId)).rejects.toThrow(/verified domain/);
  });
});
