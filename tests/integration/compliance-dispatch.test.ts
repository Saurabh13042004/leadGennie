import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";

const sendMock = vi.fn();
vi.mock("@/lib/email/resend", () => ({
  isEmailConfigured: () => true,
  sendCampaignEmail: (input: unknown) => sendMock(input),
}));

import { filterCompliantLeads, CHANNEL_COOLDOWN_DAYS } from "@/lib/compliance";
import { processEmailSends } from "@/lib/campaigns/dispatch";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { GET as unsubscribe } from "@/app/api/unsubscribe/route";

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** A running campaign with an active mailbox on a verified domain and one pending email send per lead. */
async function fixture(leadCount = 1) {
  const { workspaceId } = await createWorkspace();
  const [domain] = await sql`
    insert into domains (workspace_id, resend_domain_id, name, status)
    values (${workspaceId}, ${`rd-${workspaceId}`}, ${`d${workspaceId}.example.com`}, 'verified') returning id`;
  const [mailbox] = await sql`
    insert into mailboxes (workspace_id, domain_id, email, status)
    values (${workspaceId}, ${domain.id}, ${`from@d${workspaceId}.example.com`}, 'active') returning id`;
  const [campaign] = await sql`
    insert into campaigns (workspace_id, name, status, mailbox_id, from_email)
    values (${workspaceId}, 'C', 'running', ${mailbox.id}, ${`from@d${workspaceId}.example.com`}) returning id`;
  const [step] = await sql`
    insert into campaign_steps (campaign_id, step_order, channel, subject, body)
    values (${campaign.id}, 1, 'email', 'Hi {{first_name}}', 'Hello {{first_name}} at {{company}}') returning id`;

  const leads = [];
  const sends = [];
  for (let i = 0; i < leadCount; i++) {
    const lead = await createLead(workspaceId, { fullName: `Person${i} Test`, company: "Acme" });
    leads.push(lead);
    const [s] = await sql`
      insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, subject, body)
      values (${workspaceId}, ${campaign.id}, ${lead.id}, ${step.id}, 'email', 'pending', now() - interval '1 minute', 'Hi {{first_name}}', 'Hello {{first_name}} at {{company}}')
      returning id`;
    sends.push(Number(s.id));
  }
  return {
    workspaceId, campaignId: Number(campaign.id), stepId: Number(step.id),
    mailboxId: Number(mailbox.id), domainId: Number(domain.id), leads, sends,
  };
}

const statusOf = async (sendId: number) =>
  (await sql`select status, error_message, provider_message_id, body from campaign_sends where id = ${sendId}`)[0];

let f: Fixture;
beforeEach(async () => {
  await resetDb();
  sendMock.mockReset();
  sendMock.mockResolvedValue({ id: "provider-msg-1" });
  f = await fixture();
});

describe("enrollment-time compliance (filterCompliantLeads)", () => {
  it("blocks Do Not Contact recipients, case-insensitively", async () => {
    const lead = await createLead(f.workspaceId, { email: "Someone@Example.com" });
    await sql`insert into do_not_contact (workspace_id, email) values (${f.workspaceId}, 'someone@example.com')`;
    const { allowed, blocked } = await filterCompliantLeads(f.workspaceId, [lead]);
    expect(allowed).toHaveLength(0);
    expect(blocked[0].reason).toBe("do_not_contact");
  });

  it("blocks leads sent to within the cooldown window, across campaigns", async () => {
    const lead = f.leads[0];
    await sql`update campaign_sends set status = 'sent', sent_at = now() - interval '2 days' where id = ${f.sends[0]}`;
    const res = await filterCompliantLeads(f.workspaceId, [lead]);
    expect(res.blocked[0]?.reason).toBe("cooldown");
  });

  it("does NOT block after the cooldown window, or for failed sends", async () => {
    const lead = f.leads[0];
    await sql`update campaign_sends set status = 'sent', sent_at = now() - ${`${CHANNEL_COOLDOWN_DAYS + 1} days`}::interval where id = ${f.sends[0]}`;
    expect((await filterCompliantLeads(f.workspaceId, [lead])).allowed).toHaveLength(1);
    await sql`update campaign_sends set status = 'failed', sent_at = null, scheduled_at = now() - interval '1 day' where id = ${f.sends[0]}`;
    expect((await filterCompliantLeads(f.workspaceId, [lead])).allowed).toHaveLength(1);
  });

  it("DNC in another workspace never blocks this workspace", async () => {
    const other = await createWorkspace();
    const lead = await createLead(f.workspaceId, { email: "shared@example.com" });
    await sql`insert into do_not_contact (workspace_id, email) values (${other.workspaceId}, 'shared@example.com')`;
    expect((await filterCompliantLeads(f.workspaceId, [lead])).allowed).toHaveLength(1);
  });
});

describe("send-time recheck (processEmailSends)", () => {
  it("sends a compliant message exactly once, with unsubscribe footer, and records the provider id", async () => {
    const res = await processEmailSends();
    expect(res).toMatchObject({ sent: 1, failed: 0, blocked: 0 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sent = sendMock.mock.calls[0][0];
    expect(sent.to).toBe(f.leads[0].email);
    expect(sent.body).toContain("Hello Person0 at Acme");
    expect(sent.body).toMatch(/Unsubscribe: http.*\/api\/unsubscribe\?w=/);

    const row = await statusOf(f.sends[0]);
    expect(row.status).toBe("sent");
    expect(row.provider_message_id).toBe("provider-msg-1");
    const [c] = await sql`select sent_count from campaigns where id = ${f.campaignId}`;
    expect(Number(c.sent_count)).toBe(1);

    // Running the dispatcher again must not send again.
    await processEmailSends();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("blocks a lead added to DNC AFTER enrollment", async () => {
    await sql`insert into do_not_contact (workspace_id, email) values (${f.workspaceId}, ${f.leads[0].email})`;
    const res = await processEmailSends();
    expect(res).toMatchObject({ sent: 0, blocked: 1 });
    expect(sendMock).not.toHaveBeenCalled();
    expect((await statusOf(f.sends[0])).status).toBe("blocked");
  });

  it("blocks when another campaign contacted the lead within the cooldown", async () => {
    const [other] = await sql`insert into campaigns (workspace_id, name, status) values (${f.workspaceId}, 'Other', 'running') returning id`;
    await sql`
      insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, sent_at, body)
      values (${f.workspaceId}, ${other.id}, ${f.leads[0].id}, ${f.stepId}, 'email', 'sent', now() - interval '1 day', now() - interval '1 day', 'x')`;
    const res = await processEmailSends();
    expect(res.blocked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("blocks when the mailbox was paused after approval", async () => {
    await sql`update mailboxes set status = 'paused' where id = ${f.mailboxId}`;
    const res = await processEmailSends();
    expect(res.blocked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("blocks when the domain lost verification", async () => {
    await sql`update domains set status = 'pending' where id = ${f.domainId}`;
    expect((await processEmailSends()).blocked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does not send for a paused campaign", async () => {
    await sql`update campaigns set status = 'paused' where id = ${f.campaignId}`;
    expect((await processEmailSends()).processed).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("marks a lead with no email as failed instead of sending", async () => {
    await sql`update leads set email = null where id = ${f.leads[0].id}`;
    expect((await processEmailSends()).failed).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("records a provider failure without marking the send as sent", async () => {
    sendMock.mockRejectedValueOnce(new Error("Resend 500"));
    const res = await processEmailSends();
    expect(res.failed).toBe(1);
    const row = await statusOf(f.sends[0]);
    expect(row.status).toBe("failed");
    expect(row.error_message).toBe("Resend 500");
    const [c] = await sql`select sent_count from campaigns where id = ${f.campaignId}`;
    expect(Number(c.sent_count)).toBe(0);
  });

  it("scoped dispatch only touches the given workspace", async () => {
    const other = await fixture();
    await processEmailSends(f.workspaceId);
    expect((await statusOf(f.sends[0])).status).toBe("sent");
    expect((await statusOf(other.sends[0])).status).toBe("pending");
  });
});

describe("unsubscribe link", () => {
  const call = (url: string) => unsubscribe(new Request(url));

  it("adds the recipient to DNC and stops later steps of the sequence", async () => {
    const email = f.leads[0].email as string;
    const res = await call(buildUnsubscribeUrl("http://localhost:3000", f.workspaceId, email));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("unsubscribed");
    const dnc = await sql`select source from do_not_contact where workspace_id = ${f.workspaceId} and lower(email) = lower(${email})`;
    expect(dnc[0].source).toBe("unsubscribe_link");

    // The still-pending later step for that lead is now blocked, not sent.
    expect((await processEmailSends()).blocked).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("is idempotent", async () => {
    const url = buildUnsubscribeUrl("http://localhost:3000", f.workspaceId, "a@example.com");
    await call(url);
    expect((await call(url)).status).toBe(200);
    const rows = await sql`select 1 from do_not_contact where workspace_id = ${f.workspaceId}`;
    expect(rows).toHaveLength(1);
  });

  it("rejects a tampered token, a swapped email, or a swapped workspace — and writes nothing", async () => {
    const url = new URL(buildUnsubscribeUrl("http://localhost:3000", f.workspaceId, "a@example.com"));
    const tampered = [
      (u: URL) => u.searchParams.set("t", "AAAAAAAAAAAAAAAAAAAAAA"),
      (u: URL) => u.searchParams.set("e", "victim@example.com"),
      (u: URL) => u.searchParams.set("w", String(f.workspaceId + 1)),
      (u: URL) => u.searchParams.delete("t"),
    ];
    for (const mutate of tampered) {
      const u = new URL(url);
      mutate(u);
      const res = await call(u.toString());
      expect(res.status).toBe(400);
    }
    expect(await sql`select 1 from do_not_contact`).toHaveLength(0);
  });

  it("HTML-escapes the address it echoes back", async () => {
    const evil = `<img src=x onerror=alert(1)>@example.com`;
    const res = await call(buildUnsubscribeUrl("http://localhost:3000", f.workspaceId, evil));
    const html = await res.text();
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
