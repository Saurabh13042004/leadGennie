import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createUser, createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";

const sendMock = vi.fn();
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  sendCampaignEmail: (input: unknown) => sendMock(input),
}));

import { processEmailSends } from "@/lib/campaigns/dispatch";
import { decideApproval } from "@/lib/actions/approvals";
import { resolveAudience } from "@/lib/domain/campaigns/audience";
import { cancelCampaign, launchCampaign, pauseCampaign, resumeCampaign, submitForApproval } from "@/lib/domain/campaigns/lifecycle";
import { previewForLead, sendTestEmail } from "@/lib/domain/campaigns/preview";
import { getCampaignDetail, listCampaignItems } from "@/lib/domain/campaigns/read-model";
import { checkReadiness } from "@/lib/domain/campaigns/readiness";
import { loadCampaign } from "@/lib/domain/campaigns/repository";
import { createDraftCampaign, updateAudience, updateBasics, updateSteps } from "@/lib/domain/campaigns/service";
import { DEFAULT_SEND_WINDOW } from "@/lib/domain/campaigns/types";
import { POST as createRoute } from "@/app/api/campaigns/route";
import { PATCH as patchRoute } from "@/app/api/campaigns/[id]/route";
import { POST as launchRoute } from "@/app/api/campaigns/[id]/launch/route";
import { POST as actionRoute } from "@/app/api/campaigns/[id]/[action]/route";
import { GET as previewRoute } from "@/app/api/campaigns/[id]/preview/route";
import { POST as resolveRoute } from "@/app/api/campaigns/[id]/audience/resolve/route";
import { createCampaignFromWizard } from "@/lib/actions/campaign-builder";

type W = Awaited<ReturnType<typeof setup>>;
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];
const n = async (q: PromiseLike<Record<string, unknown>[]>) => Number((await q)[0].n);

/** A workspace (owner signed in) with a verified, active mailbox (limit 100/day) and three clean leads. */
async function setup() {
  const { workspaceId, user } = await createWorkspace();
  setSession({ workspaceId, userId: user.id, email: user.email, role: "owner" });
  const [domain] = await sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${workspaceId}, ${`rd${workspaceId}`}, ${`w${workspaceId}.example.com`}, 'verified') returning id`;
  const [mailbox] = await sql`insert into mailboxes (workspace_id, domain_id, email, status, daily_limit) values (${workspaceId}, ${domain.id}, ${`me@w${workspaceId}.example.com`}, 'active', 100) returning id`;
  const leads = [];
  for (const [name, company] of [["Sarah Chen", "Acme"], ["Tom Baker", "Globex"], ["Priya Nair", "Initech"]]) leads.push(await createLead(workspaceId, { fullName: name, company }));
  return { workspaceId, user, actor: { workspaceId, userId: user.id }, mailboxId: Number(mailbox.id), leads };
}

const STEPS = [
  { waitDays: 0, subject: "Question for {{company}}", body: "Hi {{first_name}}, how does {{company}} book meetings today?", mode: "template" },
  { waitDays: 3, subject: "", body: "Hi {{first_name}}, following up on my note.", mode: "template" },
  { waitDays: 4, subject: "", body: "{{first_name}}, one more idea for {{company}}.", mode: "template" },
  { waitDays: 5, subject: "", body: "Last note from me, {{first_name}}.", mode: "template" },
];
const basics = (w: W, over: Record<string, unknown> = {}) => ({
  name: "Q4 outbound", mailboxId: w.mailboxId, tone: "concise", dailyLimit: 50, totalLimit: null,
  sendWindow: { ...DEFAULT_SEND_WINDOW, days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 }, allowTemplateFallback: false, ...over,
});

/** Built, approved and ready — the common starting point. */
async function readyCampaign(w: W) {
  const id = await createDraftCampaign(w.actor, { name: "Q4 outbound" });
  await updateBasics(w.actor, id, basics(w));
  await updateSteps(w.actor, id, STEPS);
  const { approvalId } = await submitForApproval(w.actor, id);
  await decideApproval(approvalId, "approved", "ok");
  return { id, approvalId };
}

const routeCtx = <P extends Record<string, string>>(p: P) => ({ params: Promise.resolve(p) });
const json = (body: unknown, method = "POST") => new Request("http://t/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

let w: W;
beforeEach(async () => {
  await resetDb();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ id: "msg-1" });
  w = await setup();
});

describe("building a campaign", () => {
  it("starts as a draft with a 4-step email cadence (Day 0/3/7/12), every step editable", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    const c = await loadCampaign(w.workspaceId, id);
    expect(c).toMatchObject({ status: "draft", sendModel: "leads" });
    expect(c.steps.map((s) => s.waitDays)).toEqual([0, 3, 4, 5]);
    await updateSteps(w.actor, id, [...STEPS, { waitDays: 2, subject: "", body: "Fifth", mode: "template" }]);
    const again = await loadCampaign(w.workspaceId, id);
    expect(again.steps).toHaveLength(5);
    expect(again.steps[1]).toMatchObject({ subject: "", body: STEPS[1].body, waitDays: 3 });
  });

  it("validates limits against the mailbox and rejects unknown mailboxes and bad windows", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    await expect(updateBasics(w.actor, id, basics(w, { dailyLimit: 150 }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateBasics(w.actor, id, basics(w, { mailboxId: 999999 }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateBasics(w.actor, id, basics(w, { sendWindow: { ...DEFAULT_SEND_WINDOW, startHour: 18, endHour: 9 } }))).rejects.toBeDefined();
    const c = await updateBasics(w.actor, id, basics(w, { dailyLimit: 100, totalLimit: 2 }));
    expect(c).toMatchObject({ dailyLimit: 100, totalLimit: 2, fromEmail: `me@w${w.workspaceId}.example.com` });
  });

  it("the readiness checklist names each blocker, and submit refuses while any exist", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    const r = await checkReadiness(w.workspaceId, await loadCampaign(w.workspaceId, id));
    const text = r.blockers.map((b) => b.message).join(" | ");
    expect(text).toMatch(/Pick a sending mailbox/);
    expect(text).toMatch(/Step 1 needs a subject/);
    await expect(submitForApproval(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("draft");
  });

  it("audience: hand-picked leads are resolved within the workspace; foreign segments are rejected", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Picked" });
    const other = await createWorkspace();
    const foreignLead = await createLead(other.workspaceId, { fullName: "Not Yours" });
    await updateAudience(w.actor, id, { source: "leads", leadIds: [w.leads[0].id, foreignLead.id] });
    const r = await checkReadiness(w.workspaceId, await loadCampaign(w.workspaceId, id));
    expect(r.audience.eligible.map((l) => l.id)).toEqual([w.leads[0].id]);
    expect(r.audience.notes.join()).toMatch(/1 selected lead\(s\) no longer exist/);
    const [seg] = await sql`insert into segments (workspace_id, name, criteria) values (${other.workspaceId}, 'Theirs', '{}') returning id`;
    await expect(updateAudience(w.actor, id, { source: "segment", segmentId: Number(seg.id) })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("seeds the sequence from a saved workflow template (email steps only, V1)", async () => {
    const [wf] = await sql`insert into workflows (workspace_id, name, source_type) values (${w.workspaceId}, 'Flow', 'all_leads') returning id`;
    await sql`insert into workflow_steps (workflow_id, step_order, channel, wait_days, subject, body) values
      (${wf.id}, 1, 'email', 0, 'Hello', 'Body 1'), (${wf.id}, 2, 'linkedin_dm', 2, null, 'DM'), (${wf.id}, 3, 'email', 3, null, 'Body 2')`;
    const id = await createDraftCampaign(w.actor, { name: "From flow", workflowId: Number(wf.id) });
    const c = await loadCampaign(w.workspaceId, id);
    expect(c.steps.map((s) => [s.waitDays, s.body])).toEqual([[0, "Body 1"], [5, "Body 2"]]);
  });
});

describe("the New campaign wizard (email-only)", () => {
  const wizardSteps = [
    { waitDays: 0, subject: "Question for {{company}}", body: "Hi {{first_name}}, how does {{company}} book meetings?" },
    { waitDays: 3, subject: "ignored for follow-ups", body: "Following up, {{first_name}}." },
  ];

  it("creates an email campaign in the Phase 4 model and submits it for approval in one click", async () => {
    const res = await createCampaignFromWizard({ name: "From wizard", audienceSegmentId: null, mailboxId: w.mailboxId, dailyLimit: 40, steps: wizardSteps });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ submitted: true, blockers: [] });
    const c = await loadCampaign(w.workspaceId, res.data.id);
    expect(c).toMatchObject({ status: "pending_approval", sendModel: "leads", dailyLimit: 40, mailboxId: w.mailboxId });
    expect(c.steps.map((s) => [s.waitDays, s.subject])).toEqual([[0, "Question for {{company}}"], [3, ""]]);
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${res.data.id}`)).toBe(0);
  });

  it("keeps the campaign as a draft and returns the blockers when it can't be submitted yet", async () => {
    const res = await createCampaignFromWizard({ name: "No copy", audienceSegmentId: null, mailboxId: w.mailboxId, dailyLimit: 40, steps: [{ waitDays: 0, subject: "", body: "" }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.submitted).toBe(false);
    expect(res.data.blockers.join(" | ")).toMatch(/needs a subject/);
    expect((await loadCampaign(w.workspaceId, res.data.id)).status).toBe("draft");
  });

  it("accepts ids as strings (bigints from the list actions arrive that way in the browser)", async () => {
    const res = await createCampaignFromWizard({ name: "Str ids", audienceSegmentId: null, mailboxId: String(w.mailboxId), dailyLimit: 40, steps: wizardSteps });
    expect(res).toMatchObject({ ok: true, data: { submitted: true } });
  });

  it("clamps the daily limit to the mailbox's and rejects invalid input", async () => {
    const res = await createCampaignFromWizard({ name: "Fast", audienceSegmentId: null, mailboxId: w.mailboxId, dailyLimit: 500, steps: wizardSteps });
    expect(res.ok && (await loadCampaign(w.workspaceId, res.data.id)).dailyLimit).toBe(100);
    const bad = await createCampaignFromWizard({ name: "x", audienceSegmentId: null, mailboxId: w.mailboxId, dailyLimit: 40, steps: [] });
    expect(bad).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});

describe("audience resolution: every exclusion counted", () => {
  it("counts DNC, unsubscribed, bounced, cooldown, in-another-campaign, no email and invalid email", async () => {
    const add = (name: string, email: string | null) => createLead(w.workspaceId, { fullName: name, email });
    const dnc = await add("D", "dnc@x.example");
    const unsub = await add("U", "unsub@x.example");
    const bounce = await add("B", "bounce@x.example");
    await add("N", null);
    await add("I", "not-an-email");
    await add("R", "info@x.example");
    await sql`insert into do_not_contact (workspace_id, email, source) values
      (${w.workspaceId}, 'dnc@x.example', 'manual'), (${w.workspaceId}, 'unsub@x.example', 'unsubscribe_link'), (${w.workspaceId}, 'bounce@x.example', 'resend_webhook')`;
    // Tom was emailed by another campaign 2 days ago → cooldown. Priya is active in another running builder campaign.
    const [other] = await sql`insert into campaigns (workspace_id, name, status, send_model) values (${w.workspaceId}, 'Other', 'running', 'leads') returning id`;
    const [st] = await sql`insert into campaign_steps (campaign_id, step_order, channel, body) values (${other.id}, 1, 'email', 'x') returning id`;
    await sql`insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, sent_at, body)
      values (${w.workspaceId}, ${other.id}, ${w.leads[1].id}, ${st.id}, 'email', 'sent', now() - interval '2 days', now() - interval '2 days', 'x')`;
    await sql`insert into campaign_leads (workspace_id, campaign_id, lead_id, status) values (${w.workspaceId}, ${other.id}, ${w.leads[2].id}, 'active')`;

    const r = await resolveAudience(w.workspaceId, { source: "all", segmentId: null, leadIds: [], filters: { minIcpScore: null, requireResearched: false, qualifiedOnly: false, includeRiskyEmails: false } });
    expect(r.eligible.map((l) => l.id)).toEqual([w.leads[0].id]);
    expect(r.exclusions).toMatchObject({ do_not_contact: 1, unsubscribed: 1, bounced: 1, cooldown: 1, in_other_campaign: 1, no_email: 1, invalid_email: 1, risky_email: 1 });
    expect(r.excludedIds.do_not_contact).toEqual([dnc.id]);
    expect(r.excludedIds.unsubscribed).toEqual([unsub.id]);
    expect(r.excludedIds.bounced).toEqual([bounce.id]);
  });

  it("ICP filters exclude unresearched and low-scoring leads — shown, not dropped", async () => {
    await sql`update leads set research_status = 'done', icp_score = 90, qualified = true where id = ${w.leads[0].id}`;
    await sql`update leads set research_status = 'done', icp_score = 40, qualified = false where id = ${w.leads[1].id}`;
    const r = await resolveAudience(w.workspaceId, { source: "all", segmentId: null, leadIds: [], filters: { minIcpScore: 60, requireResearched: true, qualifiedOnly: false, includeRiskyEmails: false } });
    expect(r.eligible.map((l) => l.id)).toEqual([w.leads[0].id]);
    expect(r.exclusions).toMatchObject({ unresearched: 1, below_icp_score: 1 });
  });

  it("a segment that matches nobody selects nobody (it is not widened to all leads)", async () => {
    const [seg] = await sql`insert into segments (workspace_id, name, criteria) values (${w.workspaceId}, 'Empty', '{}') returning id`;
    const r = await resolveAudience(w.workspaceId, { source: "segment", segmentId: Number(seg.id), leadIds: [], filters: { minIcpScore: null, requireResearched: false, qualifiedOnly: false, includeRiskyEmails: false } });
    expect(r.eligible).toEqual([]);
    expect(r.notes.join()).toMatch(/selects nobody/);
  });
});

describe("approval gates launch", () => {
  it("submit → pending_approval with the audience snapshot; approval (actor + time) → ready; nothing is sent or enrolled yet", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    await updateBasics(w.actor, id, basics(w));
    await updateSteps(w.actor, id, STEPS);
    const { approvalId } = await submitForApproval(w.actor, id);
    const a = await one(sql`select status, payload from approvals where id = ${approvalId}`);
    expect(a.status).toBe("pending");
    expect((a.payload as { totalLeads: number; leadIds: number[] }).leadIds.sort()).toEqual(w.leads.map((l) => l.id).sort());
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("pending_approval");
    await expect(updateSteps(w.actor, id, STEPS)).rejects.toMatchObject({ code: "CONFLICT" });

    await decideApproval(approvalId, "approved", "lgtm");
    const c = await loadCampaign(w.workspaceId, id);
    expect(c.status).toBe("ready");
    expect(c.approvedAt).not.toBeNull();
    const decided = await one(sql`select decided_by_user_id, decided_at from approvals where id = ${approvalId}`);
    expect(Number(decided.decided_by_user_id)).toBe(w.user.id);
    expect(decided.decided_at).not.toBeNull();
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id}`)).toBe(0);
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id}`)).toBe(0);
  });

  it("a member can submit but not approve; rejection returns it for editing", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    await updateBasics(w.actor, id, basics(w));
    await updateSteps(w.actor, id, STEPS);
    const member = await createUser();
    await sql`insert into workspace_members (workspace_id, user_id, role, status) values (${w.workspaceId}, ${member.id}, 'member', 'active')`;
    setSession({ workspaceId: w.workspaceId, userId: member.id, email: member.email, role: "member" });
    const { approvalId } = await submitForApproval({ workspaceId: w.workspaceId, userId: member.id }, id);
    await expect(decideApproval(approvalId, "approved")).rejects.toMatchObject({ code: "FORBIDDEN" });
    setSession({ workspaceId: w.workspaceId, userId: w.user.id, email: w.user.email, role: "owner" });
    await decideApproval(approvalId, "rejected", "too broad");
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("rejected");
    await updateSteps(w.actor, id, STEPS.slice(0, 2)); // editable again
    expect((await loadCampaign(w.workspaceId, id)).steps).toHaveLength(2);
  });

  it("launch is impossible without an APPROVED approval — even if the status was forced to ready", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    await updateBasics(w.actor, id, basics(w));
    await updateSteps(w.actor, id, STEPS);
    await expect(launchCampaign(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" }); // draft → running is illegal
    await sql`update campaigns set status = 'ready' where id = ${id}`;
    await expect(launchCampaign(w.actor, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { approvalId } = await (async () => {
      await sql`update campaigns set status = 'draft' where id = ${id}`;
      return submitForApproval(w.actor, id);
    })();
    await sql`update campaigns set status = 'ready' where id = ${id}`; // forged: approval still pending
    await expect(launchCampaign(w.actor, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(approvalId).toBeGreaterThan(0);
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id}`)).toBe(0);
  });
});

describe("launch → dispatch", () => {
  it("enrolls every approved lead, schedules every step (threaded) and launch is idempotent", async () => {
    const { id } = await readyCampaign(w);
    const res = await launchCampaign(w.actor, id);
    expect(res.enrolled).toBe(3);
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("running");
    const leads = await sql`select status, next_action_at from campaign_leads where campaign_id = ${id}`;
    expect(leads.every((l) => l.status === "active" && l.next_action_at)).toBe(true);
    const sends = await sql`
      select cs.subject, cs.body, st.step_order, l.full_name from campaign_sends cs join campaign_steps st on st.id = cs.step_id join leads l on l.id = cs.lead_id
      where cs.campaign_id = ${id} order by l.full_name, st.step_order`;
    expect(sends).toHaveLength(12);
    const priya = sends.filter((s) => s.full_name === "Priya Nair");
    expect(priya.map((s) => s.subject)).toEqual(["Question for Initech", "Re: Question for Initech", "Re: Question for Initech", "Re: Question for Initech"]);
    expect(priya[0].body).toBe("Hi Priya, how does Initech book meetings today?");

    await expect(launchCampaign(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id}`)).toBe(12);
  });

  it("re-checks at launch: someone who unsubscribed after approval is recorded as blocked, not emailed", async () => {
    const { id } = await readyCampaign(w);
    await sql`insert into do_not_contact (workspace_id, email, source) values (${w.workspaceId}, ${w.leads[1].email}, 'unsubscribe_link')`;
    const res = await launchCampaign(w.actor, id);
    expect(res.enrolled).toBe(2);
    const tom = await one(sql`select status, stop_reason from campaign_leads where campaign_id = ${id} and lead_id = ${w.leads[1].id}`);
    expect(tom).toMatchObject({ status: "blocked", stop_reason: "Unsubscribed" });
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id} and lead_id = ${w.leads[1].id}`)).toBe(0);
  });

  it("never enrolls someone the approver didn't see", async () => {
    const { id } = await readyCampaign(w);
    const late = await createLead(w.workspaceId, { fullName: "Late Comer", company: "New" });
    await launchCampaign(w.actor, id);
    // Shown (so nobody silently vanishes) but never enrolled or emailed.
    expect(await one(sql`select status, stop_reason from campaign_leads where campaign_id = ${id} and lead_id = ${late.id}`)).toMatchObject({ status: "stopped", stop_reason: "Not in the approved audience" });
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id} and lead_id = ${late.id}`)).toBe(0);
  });

  it("preview shows exactly what the sender sends (subject, body, footer)", async () => {
    const { id } = await readyCampaign(w);
    const before = await previewForLead(w.workspaceId, id, w.leads[0].id);
    expect(before.steps).toHaveLength(4);
    expect(before.excludedBecause).toBeNull();
    await launchCampaign(w.actor, id);
    const after = await previewForLead(w.workspaceId, id, w.leads[0].id);
    expect(after.steps.map((s) => [s.subject, s.body])).toEqual(before.steps.map((s) => [s.subject, s.body]));

    const r = await processEmailSends(w.workspaceId);
    expect(r.sent).toBe(3); // step 1 for each lead is due now; follow-ups are days away
    const sarahMail = sendMock.mock.calls.map((c) => c[0]).find((m) => m.to === w.leads[0].email);
    expect(sarahMail.subject).toBe(after.steps[0].subject);
    expect(sarahMail.body).toBe(`${after.steps[0].body}${after.steps[0].footer}`);
    expect(sarahMail.from).toBe(`me@w${w.workspaceId}.example.com`);

    const cl = await one(sql`select status, current_step, next_action_at from campaign_leads where campaign_id = ${id} and lead_id = ${w.leads[0].id}`);
    expect(cl).toMatchObject({ status: "active", current_step: 1 });
    expect(new Date(String(cl.next_action_at)).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
  });

  it("a follow-up is not blocked by its own campaign's first email (cooldown is cross-campaign only)", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await processEmailSends(w.workspaceId);
    await sql`update campaign_sends set scheduled_at = now() - interval '1 minute' where campaign_id = ${id} and status = 'pending'`;
    const r = await processEmailSends(w.workspaceId);
    expect(r.blocked).toBe(0);
    expect(r.sent).toBeGreaterThan(0);
  });

  it("completes the campaign once every lead has received every step", async () => {
    const { id } = await readyCampaign(w);
    await updateSteps(w.actor, id, STEPS); // no-op when unchanged: still ready
    await launchCampaign(w.actor, id);
    for (let i = 0; i < 6; i++) {
      await sql`update campaign_sends set scheduled_at = now() - interval '1 minute' where campaign_id = ${id} and status = 'pending'`;
      await processEmailSends(w.workspaceId);
    }
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id} and status = 'sent'`)).toBe(12);
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("completed");
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id} and status = 'completed'`)).toBe(3);
  });

  it("a lead suppressed mid-sequence is stopped and their later steps are canceled", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await processEmailSends(w.workspaceId);
    await sql`insert into do_not_contact (workspace_id, email, source) values (${w.workspaceId}, ${w.leads[0].email}, 'unsubscribe_link')`;
    await sql`update campaign_sends set scheduled_at = now() - interval '1 minute' where campaign_id = ${id} and status = 'pending'`;
    await processEmailSends(w.workspaceId);
    const sarah = await one(sql`select status, stop_reason from campaign_leads where campaign_id = ${id} and lead_id = ${w.leads[0].id}`);
    expect(sarah.status).toBe("blocked");
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id} and lead_id = ${w.leads[0].id} and status = 'pending'`)).toBe(0);
  });

  it("test-send goes to the signed-in user, never to the lead", async () => {
    const { id } = await readyCampaign(w);
    const r = await sendTestEmail(w.actor, id, w.leads[0].id, 1);
    expect(r.to).toBe(w.user.email);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ to: w.user.email, subject: "[Test] Question for Acme" });
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id}`)).toBe(0);
  });
});

describe("editing after approval", () => {
  it("editing a ready campaign sends it back to draft (the approval covered the old copy)", async () => {
    const { id } = await readyCampaign(w);
    await updateSteps(w.actor, id, STEPS.map((s, i) => (i === 1 ? { ...s, body: "Changed" } : s)));
    const c = await loadCampaign(w.workspaceId, id);
    expect(c).toMatchObject({ status: "draft", approvalId: null });
    await expect(launchCampaign(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("while running: sent steps are locked, unsent steps re-render into the pending sends, structure is fixed", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await processEmailSends(w.workspaceId); // step 1 goes out
    await expect(updateSteps(w.actor, id, STEPS.map((s, i) => (i === 0 ? { ...s, body: "Rewritten" } : s)))).rejects.toThrow(/already been sent/);
    await expect(updateSteps(w.actor, id, STEPS.slice(0, 3))).rejects.toThrow(/added or removed/);
    await expect(updateSteps(w.actor, id, STEPS.map((s, i) => (i === 2 ? { ...s, waitDays: 9 } : s)))).rejects.toThrow(/timing and mode/);
    await updateSteps(w.actor, id, STEPS.map((s, i) => (i === 2 ? { ...s, body: "New third step for {{company}}" } : s)));
    const bodies = await sql`
      select cs.body, l.company from campaign_sends cs join campaign_steps st on st.id = cs.step_id join leads l on l.id = cs.lead_id
      where cs.campaign_id = ${id} and st.step_order = 3`;
    expect(bodies.map((b) => b.body).sort()).toEqual(["New third step for Acme", "New third step for Globex", "New third step for Initech"]);
  });

  it("legacy campaigns can't be edited in the builder", async () => {
    const [legacy] = await sql`insert into campaigns (workspace_id, name, status) values (${w.workspaceId}, 'Old', 'running') returning id`;
    await expect(updateSteps(w.actor, Number(legacy.id), STEPS)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("pause / resume / cancel", () => {
  it("pause stops dispatch and clears next actions; resume shifts pending sends instead of bursting", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await pauseCampaign(w.actor, id);
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("paused");
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id} and next_action_at is not null`)).toBe(0);
    expect((await processEmailSends(w.workspaceId)).sent).toBe(0);

    const before = await sql`select id, scheduled_at from campaign_sends where campaign_id = ${id} and status = 'pending' order by id`;
    await sql`update campaigns set paused_at = now() - interval '2 days 3 hours' where id = ${id}`;
    await resumeCampaign(w.actor, id);
    const after = await sql`select id, scheduled_at from campaign_sends where campaign_id = ${id} and status = 'pending' order by id`;
    const shift = (new Date(String(after[0].scheduled_at)).getTime() - new Date(String(before[0].scheduled_at)).getTime()) / 86_400_000;
    expect(shift).toBe(3);
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id} and next_action_at is not null`)).toBe(3);
    await expect(resumeCampaign(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cancel stops every lead, cancels pending sends, and is final", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await cancelCampaign(w.actor, id);
    expect(await n(sql`select count(*)::int as n from campaign_sends where campaign_id = ${id} and status = 'pending'`)).toBe(0);
    expect(await n(sql`select count(*)::int as n from campaign_leads where campaign_id = ${id} and status = 'stopped' and stop_reason = 'Campaign canceled'`)).toBe(3);
    await expect(resumeCampaign(w.actor, id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await processEmailSends(w.workspaceId)).sent).toBe(0);
  });

  it("canceling a campaign awaiting approval closes the request so it can't be approved later", async () => {
    const id = await createDraftCampaign(w.actor, { name: "Q4" });
    await updateBasics(w.actor, id, basics(w));
    await updateSteps(w.actor, id, STEPS);
    const { approvalId } = await submitForApproval(w.actor, id);
    await cancelCampaign(w.actor, id);
    await expect(decideApproval(approvalId, "approved")).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await loadCampaign(w.workspaceId, id)).status).toBe("canceled");
  });
});

describe("personalized first step (Phase 3 drafts)", () => {
  async function draftFor(leadId: number, status: string) {
    const [g] = await sql`insert into message_generations (workspace_id, channel, model, prompt, output_body) values (${w.workspaceId}, 'email', 'fake', 'p', 'b') returning id`;
    await sql`insert into message_drafts (workspace_id, lead_id, status, subject, body, original_subject, original_body, tone, prompt_version, model, generation_id)
      values (${w.workspaceId}, ${leadId}, ${status}, ${`Sourced subject ${leadId}`}, ${`Sourced body for ${leadId}`}, 's', 'b', 'concise', 'cold-email/v1', 'fake', ${g.id})`;
  }
  const personalizedSteps = [{ ...STEPS[0], mode: "personalized", subject: "", body: "" }, ...STEPS.slice(1)];

  it("unapproved drafts block submit; once approved, each lead gets THEIR draft and follow-ups thread under it", async () => {
    await draftFor(w.leads[0].id, "approved");
    await draftFor(w.leads[1].id, "failed_validation");
    const id = await createDraftCampaign(w.actor, { name: "P" });
    await updateBasics(w.actor, id, basics(w));
    await updateSteps(w.actor, id, personalizedSteps);
    await expect(submitForApproval(w.actor, id)).rejects.toThrow(/approved personalised email/);

    await sql`update message_drafts set status = 'approved' where lead_id in (${w.leads[1].id})`;
    await draftFor(w.leads[2].id, "approved");
    const { approvalId } = await submitForApproval(w.actor, id);
    await decideApproval(approvalId, "approved");
    await launchCampaign(w.actor, id);
    const tom = await sql`
      select cs.subject, cs.body, cs.message_draft_id, st.step_order from campaign_sends cs join campaign_steps st on st.id = cs.step_id
      where cs.campaign_id = ${id} and cs.lead_id = ${w.leads[1].id} order by st.step_order`;
    expect(tom[0]).toMatchObject({ subject: `Sourced subject ${w.leads[1].id}`, body: `Sourced body for ${w.leads[1].id}` });
    expect(tom[0].message_draft_id).not.toBeNull();
    expect(tom[1].subject).toBe(`Re: Sourced subject ${w.leads[1].id}`);
  });

  it("the explicit template fallback lets leads without an approved draft get the template", async () => {
    await draftFor(w.leads[0].id, "approved");
    const id = await createDraftCampaign(w.actor, { name: "P" });
    await updateBasics(w.actor, id, basics(w, { allowTemplateFallback: true }));
    await updateSteps(w.actor, id, [{ ...STEPS[0], mode: "personalized" }, ...STEPS.slice(1)]);
    const { approvalId } = await submitForApproval(w.actor, id);
    await decideApproval(approvalId, "approved");
    await launchCampaign(w.actor, id);
    const first = await sql`select cs.lead_id, cs.subject, cs.message_draft_id from campaign_sends cs join campaign_steps st on st.id = cs.step_id where cs.campaign_id = ${id} and st.step_order = 1 order by cs.lead_id`;
    expect(first.map((f) => f.message_draft_id !== null)).toEqual([true, false, false]);
    expect(first[1].subject).toBe("Question for Globex");
  });
});

describe("list, detail, tenancy, routes", () => {
  it("list shows real counts only — no reply rate, replies null until tracked", async () => {
    const { id } = await readyCampaign(w);
    await launchCampaign(w.actor, id);
    await processEmailSends(w.workspaceId);
    const [item] = await listCampaignItems(w.workspaceId);
    expect(item).toMatchObject({ id, status: "running", audienceSize: 3, sent: 3, replied: null, steps: 4 });
    expect(item.nextSendAt).not.toBeNull();
    expect(Object.keys(item)).not.toContain("replyRate");
    const detail = await getCampaignDetail(w.workspaceId, id);
    expect(detail.approval).toMatchObject({ status: "approved", decidedBy: "Test User" });
    expect(detail.leads).toHaveLength(3);
    expect(detail.lockedStepIds).toEqual([detail.campaign.steps[0].id]);
    expect(detail.activity.map((a) => a.summary).join(" | ")).toMatch(/Launched/);
  });

  it("another workspace can't read, edit, preview, launch or pause a campaign", async () => {
    const { id } = await readyCampaign(w);
    const other = await createWorkspace();
    const actor = { workspaceId: other.workspaceId, userId: other.user.id };
    await expect(loadCampaign(other.workspaceId, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateSteps(actor, id, STEPS)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(previewForLead(other.workspaceId, id, w.leads[0].id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(launchCampaign(actor, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(pauseCampaign(actor, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listCampaignItems(other.workspaceId)).toEqual([]);
    // and our own lead can't be previewed through their campaign ids
    const theirs = await createDraftCampaign(actor, { name: "Theirs" });
    await expect(previewForLead(other.workspaceId, theirs, w.leads[0].id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("HTTP routes speak the envelope: create, patch, resolve, preview, launch, pause", async () => {
    const created = await createRoute(json({ name: "Via API" }), undefined);
    expect(created.status).toBe(201);
    const data = await created.json();
    expect(data).toMatchObject({ ok: true, status: "draft" });
    const ctx = routeCtx({ id: String(data.id) });
    const patched = await patchRoute(json({ basics: basics(w), steps: STEPS }, "PATCH"), ctx);
    expect(patched.status).toBe(200);
    expect((await patched.json()).readiness.blockers).toEqual([]);
    const bad = await patchRoute(json({ basics: { name: "" } }, "PATCH"), ctx);
    expect(bad.status).toBe(422);
    const resolved = await resolveRoute(new Request("http://t", { method: "POST" }), ctx);
    expect(await resolved.json()).toMatchObject({ ok: true, candidates: 3, eligible: 3 });
    const preview = await previewRoute(new Request(`http://t/?leadId=${w.leads[0].id}`), ctx);
    expect((await preview.json()).steps).toHaveLength(4);
    const early = await launchRoute(new Request("http://t", { method: "POST" }), ctx);
    expect(early.status).toBe(409);
    const unknown = await actionRoute(new Request("http://t", { method: "POST" }), routeCtx({ id: String(data.id), action: "explode" }));
    expect(unknown.status).toBe(404);
    const pauseDraft = await actionRoute(new Request("http://t", { method: "POST" }), routeCtx({ id: String(data.id), action: "pause" }));
    expect(pauseDraft.status).toBe(409);
  });
});
