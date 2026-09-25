import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";
import { createOAuthMailbox, installMailboxFakes } from "../helpers/mailboxes";
import { installFakeMail, runSends } from "../helpers/sending";
import { MailProviderError } from "@/lib/email/provider";
import { enqueue } from "@/lib/jobs/queue";
import { runTick } from "@/lib/jobs/worker";
import { sendingTestHooks } from "@/lib/domain/sending/handler";
import { retryFailedSend } from "@/lib/domain/sending/failures";

const { providers } = installMailboxFakes();
const { mail } = installFakeMail(); // the Resend fake, to prove both kinds of mailbox coexist

/** A running LEGACY-model campaign (pre-rendered sends) that sends through a Gmail-connected mailbox — no domain anywhere. */
async function fixture(leadCount = 1, opts: { mailboxLimit?: number; mailboxStatus?: "active" | "paused" | "reconnect_required" | "disconnected"; provider?: "gmail" | "microsoft" } = {}) {
  const { workspaceId } = await createWorkspace();
  const mb = await createOAuthMailbox(workspaceId, { provider: opts.provider ?? "gmail", email: `sales@corp${workspaceId}.com`, status: opts.mailboxStatus ?? "active", dailyLimit: opts.mailboxLimit ?? 100_000 });
  const [campaign] = await sql`insert into campaigns (workspace_id, name, status, mailbox_id, from_email, daily_email_limit) values (${workspaceId}, 'C', 'running', ${mb.id}, ${mb.email}, 100000) returning id`;
  const [step] = await sql`insert into campaign_steps (campaign_id, step_order, channel, subject, body) values (${campaign.id}, 1, 'email', 'Hi {{first_name}}', 'Hello {{first_name}}') returning id`;
  const leads: { id: number; email: string | null }[] = [];
  const sends: number[] = [];
  for (let i = 0; i < leadCount; i++) {
    const lead = await createLead(workspaceId, { fullName: `Person${i} Test`, email: `p${i}@lead${i}.example.org` });
    leads.push(lead);
    const [s] = await sql`insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, subject, body)
                          values (${workspaceId}, ${campaign.id}, ${lead.id}, ${step.id}, 'email', 'pending', now() - interval '1 minute', 'Hi {{first_name}}', 'Hello {{first_name}}') returning id`;
    sends.push(Number(s.id));
  }
  return { workspaceId, campaignId: Number(campaign.id), stepId: Number(step.id), mailbox: mb, leads, sends };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

let f: Fixture;
beforeEach(async () => {
  await resetDb();
});
afterEach(() => {
  sendingTestHooks.afterProviderSend = undefined;
});

const send = async (id: number) => (await sql`select status, error_message, provider_message_id from campaign_sends where id = ${id}`)[0];
const messages = (workspaceId: number) => sql`select * from messages where workspace_id = ${workspaceId} order by id`;
const campaign = async (id: number) => (await sql`select status, paused_reason from campaigns where id = ${id}`)[0];
const tick = async (workspaceId: number, skipBackoff = false) => {
  if (skipBackoff) await sql`update jobs set run_at = now() where status = 'queued'`;
  return runTick({ budgetMs: 20_000, maxJobs: 100, batchSize: 25, workspaceId, workerId: "test-worker", skipSchedulers: true });
};

describe("sending through a connected mailbox", () => {
  it("sends via the mailbox's provider — no domain needed — and records who, what and which thread", async () => {
    f = await fixture(2);
    const res = await runSends();
    expect(res).toMatchObject({ sent: 2, failed: 0 });
    expect(providers.gmail.delivered).toHaveLength(2);
    expect(mail().delivered).toHaveLength(0); // Resend was not involved
    expect(providers.gmail.delivered[0]).toMatchObject({ from: f.mailbox.email, subject: "Hi Person0", headers: expect.objectContaining({ "List-Unsubscribe": expect.stringContaining("/api/unsubscribe") }) });
    const rows = await messages(f.workspaceId);
    expect(rows.map((m) => m.provider)).toEqual(["gmail", "gmail"]);
    expect(rows[0]).toMatchObject({ status: "sent", from_email: f.mailbox.email, mailbox_id: String(f.mailbox.id), provider_message_id: "fake_msg_1", provider_thread_id: "fake_thread_fake_msg_1" });
    expect(rows[0].dispatched_at).not.toBeNull(); // the write-ahead marker
    const [c] = await sql`select sent_count from campaigns where id = ${f.campaignId}`;
    expect(Number(c.sent_count)).toBe(2);
  });

  it("a provider that returns no message id (Microsoft) still counts as sent, with the id honestly null", async () => {
    f = await fixture(1, { provider: "microsoft" });
    providers.microsoft.send = async (input) => {
      providers.microsoft.delivered.push({ ...input, id: "x" });
      return { id: null, threadId: null };
    };
    expect(await runSends()).toMatchObject({ sent: 1 });
    expect((await messages(f.workspaceId))[0]).toMatchObject({ provider: "microsoft", status: "sent", provider_message_id: null, provider_thread_id: null });
    expect((await send(f.sends[0])).provider_message_id).toBeNull();
  });

  it("each mailbox uses its own provider — Gmail, Microsoft and Resend campaigns in one workspace", async () => {
    f = await fixture(1);
    const ms = await createOAuthMailbox(f.workspaceId, { provider: "microsoft", email: "m@corp.com", dailyLimit: 100_000 });
    const [d] = await sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${f.workspaceId}, 'rd', 'corp.com', 'verified') returning id`;
    const [rs] = await sql`insert into mailboxes (workspace_id, domain_id, email, status, daily_limit, created_at) values (${f.workspaceId}, ${d.id}, 'hello@corp.com', 'active', 100000, now() - interval '60 days') returning id`;
    for (const [n, mbId, from] of [["Microsoft", ms.id, "m@corp.com"], ["Resend", rs.id, "hello@corp.com"]] as const) {
      const [c] = await sql`insert into campaigns (workspace_id, name, status, mailbox_id, from_email, daily_email_limit) values (${f.workspaceId}, ${n}, 'running', ${mbId}, ${from}, 1000) returning id`;
      const [st] = await sql`insert into campaign_steps (campaign_id, step_order, channel, subject, body) values (${c.id}, 1, 'email', 's', 'b') returning id`;
      const lead = await createLead(f.workspaceId, { email: `${n.toLowerCase()}@lead.example.org` });
      await sql`insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, subject, body) values (${f.workspaceId}, ${c.id}, ${lead.id}, ${st.id}, 'email', 'pending', now() - interval '1 minute', 's', 'b')`;
    }
    await runSends();
    expect(providers.gmail.delivered.map((d) => d.from)).toEqual([f.mailbox.email]);
    expect(providers.microsoft.delivered.map((d) => d.from)).toEqual(["m@corp.com"]);
    expect(mail().delivered.map((d) => d.from)).toEqual(["hello@corp.com"]);
    expect((await sql`select provider from messages where workspace_id = ${f.workspaceId} order by provider`).map((r) => r.provider)).toEqual(["gmail", "microsoft", "resend"]);
  });
});

describe("at-most-once without an idempotency key (Gmail / Microsoft)", () => {
  it("the connection drops after the provider accepted → flagged for a person, NEVER re-sent", async () => {
    f = await fixture();
    providers.gmail.loseNextResponse();
    await runSends({ retryBackoff: true });
    await tick(f.workspaceId, true);
    await tick(f.workspaceId, true);
    expect(providers.gmail.delivered).toHaveLength(1);
    expect(providers.gmail.requests).toHaveLength(1); // not even attempted a second time
    const [m] = await messages(f.workspaceId);
    expect(m).toMatchObject({ status: "failed", error_class: "unknown_outcome" });
    expect(String(m.error)).toMatch(/Sent folder/);
    expect((await send(f.sends[0])).status).toBe("failed");
    expect((await campaign(f.campaignId)).status).toBe("running"); // one uncertain email doesn't stop the campaign
  });

  it("the process dies right after the provider accepted → the retry sees the write-ahead marker and does NOT send again", async () => {
    f = await fixture();
    let armed = true;
    sendingTestHooks.afterProviderSend = () => {
      if (armed) {
        armed = false;
        throw new Error("SIGKILL (simulated)");
      }
    };
    await runSends({ maxTicks: 1 });
    expect(providers.gmail.delivered).toHaveLength(1);
    expect((await messages(f.workspaceId))[0]).toMatchObject({ status: "sending" });

    await tick(f.workspaceId, true); // the failed job is retried
    await tick(f.workspaceId, true);
    expect(providers.gmail.delivered).toHaveLength(1); // still exactly one email in the world
    expect(providers.gmail.requests).toHaveLength(1);
    expect((await messages(f.workspaceId))[0]).toMatchObject({ status: "failed", error_class: "unknown_outcome" });
  });

  it("a crash BEFORE the provider was called is safe to retry: the marker was never set, so it sends once", async () => {
    f = await fixture();
    await sql`insert into messages (workspace_id, campaign_id, campaign_send_id, lead_id, mailbox_id, from_email, to_email, to_domain, provider, idempotency_key, status, subject, body)
              values (${f.workspaceId}, ${f.campaignId}, ${f.sends[0]}, ${f.leads[0].id}, ${f.mailbox.id}, ${f.mailbox.email}, 'p0@lead0.example.org', 'lead0.example.org', 'gmail', 'k', 'sending', 'Hi', 'Hello')`;
    await runSends();
    expect(providers.gmail.delivered).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("sent");
  });

  it("a double-delivered job still sends one email", async () => {
    f = await fixture();
    for (const key of ["manual:a", "manual:b"]) await enqueue({ workspaceId: f.workspaceId, userId: null, type: "campaign_send", payload: { campaignSendId: f.sends[0] }, idempotencyKey: key, maxAttempts: 8 });
    await tick(f.workspaceId);
    expect(providers.gmail.delivered).toHaveLength(1);
    expect(await messages(f.workspaceId)).toHaveLength(1);
  });

  it("a person who has checked the Sent folder can retry it — and only then does it go out again", async () => {
    f = await fixture();
    providers.gmail.loseNextResponse();
    await runSends();
    expect(providers.gmail.delivered).toHaveLength(1);
    await retryFailedSend(f.workspaceId, null, f.sends[0]);
    await runSends();
    expect(providers.gmail.delivered).toHaveLength(2); // deliberate: the human accepted the duplicate risk
    expect((await send(f.sends[0])).status).toBe("sent");
  });

  it("throttling (429) proves nothing was sent, so the retry goes out once", async () => {
    f = await fixture();
    providers.gmail.failNext(new MailProviderError("slow down", "rate_limited", "rateLimitExceeded", 1), 2);
    await runSends({ retryBackoff: true });
    expect(providers.gmail.requests).toHaveLength(3);
    expect(providers.gmail.delivered).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("sent");
  });
});

describe("a mailbox that can't send stops the campaign safely", () => {
  it.each([
    ["reconnect_required", /needs to be reconnected before LeadGennie can continue sending/],
    ["disconnected", /disconnected/],
    ["paused", /paused/],
  ] as const)("%s → campaign paused before any email is claimed, send kept for later", async (status, rx) => {
    f = await fixture(2, { mailboxStatus: status });
    const res = await runSends();
    expect(res).toMatchObject({ sent: 0, pending: 2 });
    expect(providers.gmail.requests).toHaveLength(0);
    expect(await messages(f.workspaceId)).toHaveLength(0);
    const c = await campaign(f.campaignId);
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(rx);
    expect(String(c.paused_reason)).toContain(f.mailbox.email);
  });

  it("the provider rejects the sign-in mid-campaign (401 after refresh) → paused with a Reconnect message, email not lost, claim released", async () => {
    f = await fixture(2);
    providers.gmail.failNext(new MailProviderError("Invalid Credentials", "auth", "unauthenticated"), 2); // a real provider rejects every concurrent call
    const res = await runSends();
    expect(res).toMatchObject({ sent: 0, pending: 2 });
    const c = await campaign(f.campaignId);
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(/Google mailbox .* needs to be reconnected/);
    expect((await messages(f.workspaceId)).every((m) => m.status === "canceled" && m.campaign_send_id === null)).toBe(true);

    // The user reconnects and resumes: everything goes out, once.
    providers.gmail.requests.length = 0;
    await sql`update campaigns set status = 'running', paused_reason = null where id = ${f.campaignId}`;
    expect(await runSends()).toMatchObject({ sent: 2 });
    expect(providers.gmail.delivered).toHaveLength(2);
  });

  it("the provider says the account can't send at all (Gmail API disabled / no Exchange mailbox) → mailbox goes to ERROR, campaign paused", async () => {
    f = await fixture(1);
    providers.gmail.failNext(new MailProviderError("Gmail API has not been used in project 123", "domain", "accessNotConfigured"), 1);
    await runSends();
    expect((await sql`select status, last_error from mailboxes where id = ${f.mailbox.id}`)[0]).toMatchObject({ status: "error", last_error: expect.stringMatching(/Gmail API/) });
    const c = await campaign(f.campaignId);
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(/won't send from/);
  });

  it("no OAuth client configured on this server → paused before claiming, with a reason that names the fix", async () => {
    f = await fixture(1);
    providers.gmail.configured = false;
    await runSends();
    expect(await messages(f.workspaceId)).toHaveLength(0);
    expect(String((await campaign(f.campaignId)).paused_reason)).toMatch(/sign-in isn't configured on this server/);
  });

  it("a permanent per-email failure fails only that email; the campaign and mailbox carry on", async () => {
    f = await fixture(2);
    providers.gmail.failNext(new MailProviderError("Invalid To header", "permanent", "invalidArgument"), 1);
    const res = await runSends();
    expect(res).toMatchObject({ sent: 1, failed: 1 });
    expect((await campaign(f.campaignId)).status).toBe("running");
    expect((await sql`select status from mailboxes where id = ${f.mailbox.id}`)[0].status).toBe("active");
  });
});

describe("the safety rules still apply to every provider", () => {
  it("the mailbox's daily limit caps sends regardless of provider — the rest wait for tomorrow", async () => {
    f = await fixture(5, { mailboxLimit: 2 });
    // effective limit = min(configured, warm-up ramp); the fixture's mailbox is 60 days old so the ramp doesn't apply.
    const res = await runSends();
    expect(res).toMatchObject({ sent: 2, pending: 3 });
    expect(providers.gmail.delivered).toHaveLength(2);
  });

  it("Do Not Contact is checked before every send", async () => {
    f = await fixture(2);
    await sql`insert into do_not_contact (workspace_id, email) values (${f.workspaceId}, ${f.leads[0].email})`;
    const res = await runSends();
    expect(res).toMatchObject({ sent: 1, blocked: 1 });
    expect(providers.gmail.recipients).toEqual([f.leads[1].email]);
  });

  it("every email carries the unsubscribe footer and RFC 8058 headers", async () => {
    f = await fixture(1);
    await sql`update workspaces set sender_name = 'Corp Inc', sender_address = '1 Main St' where id = ${f.workspaceId}`;
    await runSends();
    const sent = providers.gmail.delivered[0];
    expect(sent.text).toMatch(/Unsubscribe: .*\/api\/unsubscribe/);
    expect(sent.headers).toMatchObject({ "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  });

  it("another workspace's mailbox can't be used: a campaign pointing at it is paused, nothing is sent", async () => {
    f = await fixture(1);
    const other = await createWorkspace();
    const theirs = await createOAuthMailbox(other.workspaceId, { email: "theirs@corp.com" });
    await sql`update campaigns set mailbox_id = ${theirs.id} where id = ${f.campaignId}`;
    await runSends();
    expect(providers.gmail.requests).toHaveLength(0);
    expect((await campaign(f.campaignId)).status).toBe("paused");
  });
});
