import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";
import { applyProviderEvent, type ProviderEvent } from "@/lib/domain/sending/events";
import { suppressEmail } from "@/lib/domain/sending/suppression";

let workspaceId: number;
let otherWorkspaceId: number;
let leadEmail: string;
let messageId: number;

async function campaignWith(ws: number, leadId: number, opts: { steps?: number } = {}) {
  const [campaign] = await sql`insert into campaigns (workspace_id, name, status, send_model) values (${ws}, 'C', 'running', 'leads') returning id`;
  const [cl] = await sql`
    insert into campaign_leads (workspace_id, campaign_id, lead_id, status, next_action_at)
    values (${ws}, ${campaign.id}, ${leadId}, 'active', now() + interval '3 days') returning id`;
  for (let i = 0; i < (opts.steps ?? 1); i++) {
    const [step] = await sql`insert into campaign_steps (campaign_id, step_order, channel, subject, body) values (${campaign.id}, ${i + 2}, 'email', 's', 'b') returning id`;
    await sql`insert into campaign_sends (workspace_id, campaign_id, campaign_lead_id, lead_id, step_id, channel, status, scheduled_at, subject, body)
              values (${ws}, ${campaign.id}, ${cl.id}, ${leadId}, ${step.id}, 'email', 'pending', now() + interval '3 days', 's', 'b')`;
  }
  return { campaignId: Number(campaign.id), campaignLeadId: Number(cl.id) };
}

let n = 0;
const event = (over: Partial<ProviderEvent> = {}): ProviderEvent => ({
  eventId: `evt-${++n}`, type: "email.delivered", providerMessageId: "prov_1", occurredAt: new Date(), payload: {}, ...over,
});

beforeEach(async () => {
  await resetDb();
  ({ workspaceId } = await createWorkspace());
  ({ workspaceId: otherWorkspaceId } = await createWorkspace());
  const lead = await createLead(workspaceId, { email: "Buyer@Acme.example" });
  leadEmail = "buyer@acme.example";
  const { campaignId, campaignLeadId } = await campaignWith(workspaceId, lead.id, { steps: 2 });
  const [m] = await sql`
    insert into messages (workspace_id, campaign_id, campaign_lead_id, lead_id, from_email, to_email, to_domain, provider_message_id, idempotency_key, status, attempts, sent_at)
    values (${workspaceId}, ${campaignId}, ${campaignLeadId}, ${lead.id}, 'me@x.example', ${leadEmail}, 'acme.example', 'prov_1', 'k1', 'sent', 1, now()) returning id`;
  messageId = Number(m.id);
});

const message = async () => (await sql`select * from messages where id = ${messageId}`)[0];
const events = () => sql`select type from message_events where workspace_id = ${workspaceId} order by id`;
const dnc = () => sql`select reason, source from do_not_contact where workspace_id = ${workspaceId}`;

describe("provider events → message state", () => {
  it("the same webhook delivered twice is recorded once and changes nothing the second time", async () => {
    const e = event({ type: "email.delivered" });
    expect(await applyProviderEvent(e)).toEqual({ matched: true, recorded: true, suppressed: false });
    expect(await applyProviderEvent(e)).toEqual({ matched: true, recorded: false, suppressed: false });
    expect(await events()).toHaveLength(1);
    expect((await message()).status).toBe("delivered");
  });

  it("a duplicated hard-bounce event suppresses once and does not error", async () => {
    const e = event({ type: "email.bounced", bounce: { type: "Permanent" } });
    await applyProviderEvent(e);
    const again = await applyProviderEvent(e);
    expect(again.recorded).toBe(false);
    expect(await dnc()).toHaveLength(1);
  });

  it("delivered, opened and clicked update timestamps; opens do not change the status", async () => {
    await applyProviderEvent(event({ type: "email.delivered" }));
    await applyProviderEvent(event({ type: "email.opened" }));
    await applyProviderEvent(event({ type: "email.clicked" }));
    const m = await message();
    expect(m.status).toBe("delivered");
    expect(m.delivered_at).not.toBeNull();
    expect(m.opened_at).not.toBeNull();
    expect(m.clicked_at).not.toBeNull();
  });

  it("status only moves forward: a late 'delivered' cannot un-bounce a bounced message", async () => {
    await applyProviderEvent(event({ type: "email.bounced", bounce: { type: "Permanent" } }));
    await applyProviderEvent(event({ type: "email.delivered" }));
    expect((await message()).status).toBe("bounced");
  });

  it("an event for an email we never sent is not matched and writes nothing", async () => {
    expect(await applyProviderEvent(event({ providerMessageId: "someone_elses" }))).toEqual({ matched: false, recorded: false, suppressed: false });
    expect(await events()).toHaveLength(0);
  });

  it("the provider reporting a failed send marks it failed", async () => {
    await applyProviderEvent(event({ type: "email.failed" }));
    expect(await message()).toMatchObject({ status: "failed", error_class: "provider_reported" });
  });
});

describe("suppression: a hard bounce, complaint or provider suppression stops the address everywhere", () => {
  it("a hard bounce → DNC, sequence stopped as bounced, pending follow-ups canceled, campaign completed", async () => {
    const r = await applyProviderEvent(event({ type: "email.bounced", bounce: { type: "Permanent", message: "mailbox does not exist" } }));
    expect(r.suppressed).toBe(true);
    expect(await dnc()).toEqual([{ reason: "Hard bounce", source: "resend_webhook" }]);
    const [cl] = await sql`select status, stop_reason from campaign_leads where workspace_id = ${workspaceId}`;
    expect(cl).toMatchObject({ status: "bounced", stop_reason: "Hard bounce" });
    expect(await sql`select 1 from campaign_sends where workspace_id = ${workspaceId} and status = 'pending'`).toHaveLength(0);
    expect(await sql`select 1 from campaign_sends where workspace_id = ${workspaceId} and status = 'canceled'`).toHaveLength(2);
    expect((await sql`select status from campaigns where workspace_id = ${workspaceId}`)[0].status).toBe("completed");
    expect((await message()).status).toBe("bounced");
  });

  it("a spam complaint stops the recipient's sequences in EVERY campaign of the workspace, but not another workspace's", async () => {
    const lead = (await sql`select lead_id from messages where id = ${messageId}`)[0];
    const second = await campaignWith(workspaceId, Number(lead.lead_id));
    const foreignLead = await createLead(otherWorkspaceId, { email: leadEmail });
    const foreign = await campaignWith(otherWorkspaceId, foreignLead.id);

    await applyProviderEvent(event({ type: "email.complained" }));
    expect((await sql`select status from campaign_leads where id = ${second.campaignLeadId}`)[0].status).toBe("unsubscribed");
    expect((await sql`select status from campaign_leads where id = ${foreign.campaignLeadId}`)[0].status).toBe("active");
    expect(await sql`select 1 from do_not_contact where workspace_id = ${otherWorkspaceId}`).toHaveLength(0);
    expect((await message()).status).toBe("complained");
  });

  it("a provider-suppressed address is added to DNC", async () => {
    await applyProviderEvent(event({ type: "email.suppressed", suppressed: { type: "Bounce" } }));
    expect((await dnc())[0].reason).toMatch(/Provider-suppressed \(Bounce\)/);
  });

  it("soft bounces are retried by the provider: one does nothing, the third stops the address", async () => {
    await applyProviderEvent(event({ type: "email.bounced", bounce: { type: "Transient" } }));
    expect(await dnc()).toHaveLength(0);
    await applyProviderEvent(event({ type: "email.bounced", bounce: { type: "Transient" } }));
    expect(await dnc()).toHaveLength(0);
    const third = await applyProviderEvent(event({ type: "email.bounced", bounce: { type: "Transient" } }));
    expect(third.suppressed).toBe(true);
    expect((await dnc())[0].reason).toBe("Repeated soft bounces");
    expect((await message()).status).toBe("sent"); // a soft bounce is not a hard one: status is unchanged
  });

  it("suppressEmail is idempotent and case-insensitive on the address", async () => {
    const a = await suppressEmail(workspaceId, "BUYER@acme.example", { reason: "Unsubscribed", source: "unsubscribe_link", leadStatus: "unsubscribed" });
    const b = await suppressEmail(workspaceId, "buyer@Acme.example", { reason: "Unsubscribed", source: "unsubscribe_link", leadStatus: "unsubscribed" });
    expect(a).toMatchObject({ stoppedLeads: 1, canceledSends: 2 });
    expect(b).toEqual({ stoppedLeads: 0, canceledSends: 0 });
    expect(await dnc()).toHaveLength(1);
  });
});
