import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";
import { runSends, installFakeMail } from "../helpers/sending";

import { MailProviderError } from "@/lib/email/provider";
import { setClock } from "@/lib/domain/sending/clock";
import { enqueue, claimJobs } from "@/lib/jobs/queue";
import { runTick } from "@/lib/jobs/worker";
import { enqueueDueSends, MAX_JOB_GENERATIONS } from "@/lib/domain/sending/scheduler";
import { IDEMPOTENCY_TRUST_MS, sendingTestHooks } from "@/lib/domain/sending/handler";
import { retryFailedSend, skipFailedSend } from "@/lib/domain/sending/failures";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { POST as unsubscribePost } from "@/app/api/unsubscribe/route";

type Fixture = Awaited<ReturnType<typeof fixture>>;

/**
 * A running LEGACY-model campaign (no send window; pre-rendered sends) with an active mailbox on a verified domain and one
 * pending email per lead. The mailbox is 60 days old so the warm-up ramp doesn't apply unless a test asks for it.
 */
async function fixture(leadCount = 1, opts: { dailyEmailLimit?: number; mailboxDailyLimit?: number; mailboxAgeDays?: number } = {}) {
  const { workspaceId } = await createWorkspace();
  const [domain] = await sql`
    insert into domains (workspace_id, resend_domain_id, name, status)
    values (${workspaceId}, ${`rd-${workspaceId}`}, ${`d${workspaceId}.example.com`}, 'verified') returning id`;
  const [mailbox] = await sql`
    insert into mailboxes (workspace_id, domain_id, email, status, daily_limit, created_at)
    values (${workspaceId}, ${domain.id}, ${`from@d${workspaceId}.example.com`}, 'active', ${opts.mailboxDailyLimit ?? 100000},
            now() - ${`${opts.mailboxAgeDays ?? 60} days`}::interval) returning id`;
  const [campaign] = await sql`
    insert into campaigns (workspace_id, name, status, mailbox_id, from_email, daily_email_limit)
    values (${workspaceId}, 'C', 'running', ${mailbox.id}, ${`from@d${workspaceId}.example.com`}, ${opts.dailyEmailLimit ?? 100000}) returning id`;
  const [step] = await sql`
    insert into campaign_steps (campaign_id, step_order, channel, subject, body)
    values (${campaign.id}, 1, 'email', 'Hi {{first_name}}', 'Hello {{first_name}}') returning id`;

  const leads: { id: number; email: string | null }[] = [];
  const sends: number[] = [];
  for (let i = 0; i < leadCount; i++) {
    const lead = await createLead(workspaceId, { fullName: `Person${i} Test`, email: `p${i}@lead${i}.example.org` });
    leads.push(lead);
    const [s] = await sql`
      insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, subject, body)
      values (${workspaceId}, ${campaign.id}, ${lead.id}, ${step.id}, 'email', 'pending', now() - interval '1 minute', 'Hi {{first_name}}', 'Hello {{first_name}}')
      returning id`;
    sends.push(Number(s.id));
  }
  return { workspaceId, campaignId: Number(campaign.id), stepId: Number(step.id), mailboxId: Number(mailbox.id), leads, sends };
}

const { mail } = installFakeMail();
let f: Fixture;
beforeEach(async () => {
  await resetDb();
});
afterEach(() => {
  sendingTestHooks.afterProviderSend = undefined;
});

const send = async (id: number) => (await sql`select status, error_message, provider_message_id from campaign_sends where id = ${id}`)[0];
const messages = (workspaceId: number) => sql`select * from messages where workspace_id = ${workspaceId} order by id`;
const jobsFor = (sendId: number) => sql`select * from jobs where type = 'campaign_send' and payload ->> 'campaignSendId' = ${String(sendId)} order by id`;
const enqueueSend = (workspaceId: number, sendId: number, key: string) =>
  enqueue({ workspaceId, userId: null, type: "campaign_send", payload: { campaignSendId: sendId }, idempotencyKey: key, maxAttempts: 8 });
/** One worker pass over a workspace's queued jobs (no scheduler). `skipBackoff` makes retry/deferred jobs due first, instead of really waiting. */
const tick = async (workspaceId: number, skipBackoff = false) => {
  if (skipBackoff) await sql`update jobs set run_at = now() where status = 'queued'`;
  return runTick({ budgetMs: 20_000, maxJobs: 100, batchSize: 25, workspaceId, workerId: "test-worker", skipSchedulers: true });
};

describe("idempotency: the same email is never sent twice", () => {
  it("a job delivered twice (two jobs for one send) sends exactly one email", async () => {
    f = await fixture();
    await enqueueSend(f.workspaceId, f.sends[0], "manual:a");
    await enqueueSend(f.workspaceId, f.sends[0], "manual:b");
    await tick(f.workspaceId);
    expect(mail().delivered).toHaveLength(1);
    expect(await messages(f.workspaceId)).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("sent");
    const [c] = await sql`select sent_count from campaigns where id = ${f.campaignId}`;
    expect(Number(c.sent_count)).toBe(1); // counted once, not once per job
  });

  it("re-running the scheduler and the worker any number of times changes nothing once sent", async () => {
    f = await fixture(3);
    await runSends();
    for (let i = 0; i < 3; i++) {
      await enqueueDueSends();
      await runSends();
    }
    expect(mail().delivered).toHaveLength(3);
    expect(new Set(mail().delivered.map((d) => d.to)).size).toBe(3);
  });

  it("the scheduler creates one job per due send even when run concurrently", async () => {
    f = await fixture(5);
    await Promise.all([enqueueDueSends(), enqueueDueSends(), enqueueDueSends()]);
    const rows = await sql`select count(*)::int as n from jobs where workspace_id = ${f.workspaceId} and type = 'campaign_send'`;
    expect(Number(rows[0].n)).toBe(5);
  });
});

describe("crash recovery: kill the worker at the worst moment", () => {
  it("dies AFTER the provider accepted but BEFORE the database was updated → retry reconciles: no duplicate, nothing lost", async () => {
    f = await fixture();
    let armed = true;
    sendingTestHooks.afterProviderSend = () => {
      if (armed) {
        armed = false;
        throw new Error("SIGKILL (simulated)");
      }
    };
    await runSends({ maxTicks: 1 });
    // Crash state: the email left, the send row still says pending, but the durable message row records that it was attempted.
    expect(mail().delivered).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("pending");
    expect((await messages(f.workspaceId))[0]).toMatchObject({ status: "sending", provider_message_id: null });

    await tick(f.workspaceId, true); // the failed job is retried
    expect(mail().requests.length).toBeGreaterThanOrEqual(2); // the retry DID call the provider…
    expect(mail().delivered).toHaveLength(1); // …with the same idempotency key, so the provider sent nothing new
    expect(new Set(mail().requests.map((r) => r.idempotencyKey)).size).toBe(1);
    const row = await send(f.sends[0]);
    expect(row.status).toBe("sent");
    expect(row.provider_message_id).toBe(mail().delivered[0].id);
    const [m] = await messages(f.workspaceId);
    expect(m).toMatchObject({ status: "sent", provider_message_id: mail().delivered[0].id });
    expect(await messages(f.workspaceId)).toHaveLength(1);
  });

  it("the provider accepted but the response was lost (network) → replay with the same key, one delivery", async () => {
    f = await fixture();
    mail().loseNextResponse();
    await runSends({ retryBackoff: true });
    await tick(f.workspaceId, true);
    expect(mail().delivered).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("sent");
    expect((await messages(f.workspaceId))[0].provider_message_id).toBe(mail().delivered[0].id);
  });

  it("a worker that vanished mid-job: its lease expires, another worker takes over and finishes without a duplicate", async () => {
    f = await fixture();
    await enqueueSend(f.workspaceId, f.sends[0], "manual:lease");
    const [claimed] = await claimJobs("worker-that-dies", 1, 60);
    expect(claimed).toBeTruthy(); // claimed, then the process is killed: never completes
    expect((await tick(f.workspaceId)).claimed).toBe(0); // lease still valid → nobody else may take it
    await sql`update jobs set locked_until = now() - interval '1 second' where id = ${claimed.id}`;
    const t = await tick(f.workspaceId);
    expect(t.claimed).toBe(1);
    expect(mail().delivered).toHaveLength(1);
    const [j] = await jobsFor(f.sends[0]);
    expect(j).toMatchObject({ status: "succeeded" });
    expect(Number(j.attempts)).toBe(1); // the lost lease counted as one failed attempt
  });

  it("an unfinished message older than the idempotency window is flagged, NOT resent (a miss beats a duplicate)", async () => {
    f = await fixture();
    mail().failNext(new MailProviderError("connection reset", "retryable", "network_error"), 100);
    await enqueueDueSends();
    await sql`update jobs set attempts = 7 where type = 'campaign_send'`; // the next failure is the final attempt
    await tick(f.workspaceId);
    const [m] = await messages(f.workspaceId);
    expect(m.status).toBe("sending"); // ambiguous: kept, waiting — never marked sent, never dropped
    expect((await send(f.sends[0])).status).toBe("pending");

    setClock(() => new Date(Date.now() + IDEMPOTENCY_TRUST_MS + 3_600_000));
    const before = mail().requests.length;
    await tick(f.workspaceId, true);
    expect(mail().requests.length).toBe(before); // no request: the key can't be trusted any more
    expect((await messages(f.workspaceId))[0]).toMatchObject({ status: "failed", error_class: "unknown_outcome" });
    expect((await send(f.sends[0])).status).toBe("failed");
  });
});

describe("job queue safety", () => {
  it("two workers claiming at once never take the same job", async () => {
    f = await fixture(20);
    await enqueueDueSends();
    const [a, b] = await Promise.all([claimJobs("w1", 12, 60), claimJobs("w2", 12, 60)]);
    const ids = [...a, ...b].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(20);
  });

  it("a job with an invalid payload is dead-lettered, not retried forever", async () => {
    f = await fixture();
    await enqueue({ workspaceId: f.workspaceId, userId: null, type: "campaign_send", payload: { nope: true }, idempotencyKey: "bad" });
    const t = await tick(f.workspaceId);
    expect(t.dead).toBe(1);
    const [j] = await sql`select status, error from jobs where workspace_id = ${f.workspaceId} and idempotency_key = 'bad'`;
    expect(j.status).toBe("dead");
    expect(String(j.error)).toMatch(/Invalid job payload/);
  });

  it("a send whose jobs keep dying is surfaced as failed after a few generations instead of looping", async () => {
    f = await fixture();
    for (let g = 1; g <= MAX_JOB_GENERATIONS; g++) {
      await sql`insert into jobs (workspace_id, type, payload, status, idempotency_key) values (${f.workspaceId}, 'campaign_send', ${JSON.stringify({ campaignSendId: f.sends[0] })}, 'dead', ${`send:${f.sends[0]}:${g}`})`;
    }
    const r = await enqueueDueSends();
    expect(r).toEqual({ enqueued: 0, poisoned: 1 });
    expect(await send(f.sends[0])).toMatchObject({ status: "failed" });
  });

  it("a worker told to exclude campaign_send (the request-triggered kick) leaves email jobs alone", async () => {
    f = await fixture();
    await enqueueDueSends();
    const t = await runTick({ workspaceId: f.workspaceId, excludeTypes: ["campaign_send"], skipSchedulers: true, workerId: "kick" });
    expect(t.claimed).toBe(0);
    expect(mail().requests).toHaveLength(0);
    expect((await runTick({ workspaceId: f.workspaceId, skipSchedulers: true, workerId: "worker" })).claimed).toBe(1);
    expect(mail().delivered).toHaveLength(1);
  });
});

describe("pausing and resuming", () => {
  it("a campaign paused mid-run stops sending immediately and resumes without losing anyone", async () => {
    f = await fixture(6);
    await enqueueDueSends(); // jobs are already queued when the user clicks Pause
    await sql`update campaigns set status = 'paused' where id = ${f.campaignId}`;
    await tick(f.workspaceId);
    expect(mail().requests).toHaveLength(0);
    expect((await sql`select 1 from campaign_sends where campaign_id = ${f.campaignId} and status = 'pending'`)).toHaveLength(6);

    await sql`update campaigns set status = 'running' where id = ${f.campaignId}`;
    const res = await runSends();
    expect(res.sent).toBe(6);
    expect(mail().delivered).toHaveLength(6);
  });

  it("a lead stopped mid-sequence is skipped", async () => {
    f = await fixture(2);
    const [cl] = await sql`insert into campaign_leads (workspace_id, campaign_id, lead_id, status) values (${f.workspaceId}, ${f.campaignId}, ${f.leads[0].id}, 'stopped') returning id`;
    await sql`update campaign_sends set campaign_lead_id = ${cl.id} where id = ${f.sends[0]}`;
    await runSends();
    expect(mail().delivered.map((d) => d.to)).toEqual([f.leads[1].email]);
  });
});

describe("limits", () => {
  it("campaign daily limit: sends up to it today, the rest on the next day", async () => {
    f = await fixture(5, { dailyEmailLimit: 3 });
    expect((await runSends()).sent).toBe(3);
    expect(mail().delivered).toHaveLength(3);
    // still the same day → nothing more, however many ticks run
    await sql`update jobs set run_at = now() where status = 'queued'`;
    await runSends();
    expect(mail().delivered).toHaveLength(3);

    setClock(() => new Date(Date.now() + 26 * 3_600_000));
    await sql`update jobs set run_at = now() where status = 'queued'`;
    await runSends();
    expect(mail().delivered).toHaveLength(5);
  });

  it("mailbox daily limit is shared by every campaign using that mailbox", async () => {
    f = await fixture(4, { mailboxDailyLimit: 2 });
    await runSends();
    // Jobs that ran in the same batch all saw room; the atomic claim let only 2 through and sent the rest back to be re-gated.
    expect(mail().delivered).toHaveLength(2);
    await tick(f.workspaceId, true);
    expect(mail().delivered).toHaveLength(2);
    const deferred = await sql`select state from jobs where workspace_id = ${f.workspaceId} and status = 'queued'`;
    expect(deferred).toHaveLength(2);
    expect(deferred.every((j) => (j.state as { deferred?: string }).deferred === "mailbox_daily_limit")).toBe(true);
  });

  it("a brand-new mailbox is capped by the warm-up ramp regardless of its configured limit", async () => {
    f = await fixture(20, { mailboxDailyLimit: 1000, mailboxAgeDays: 0 });
    await runSends();
    expect(mail().delivered).toHaveLength(15);
  });

  it("workspace-wide daily cap holds across mailboxes", async () => {
    f = await fixture(5);
    await sql`update workspaces set daily_send_cap = 2 where id = ${f.workspaceId}`;
    await runSends();
    expect(mail().delivered).toHaveLength(2);
  });

  it("per-recipient-domain throttle: no flood to one company", async () => {
    f = await fixture(5);
    await sql`update leads set email = 'person' || id || '@bigcorp.example' where workspace_id = ${f.workspaceId}`;
    process.env.SEND_DOMAIN_HOURLY_LIMIT = "2";
    await runSends();
    expect(mail().delivered).toHaveLength(2);
  });

  it("…but free-mail domains are exempt (thousands of people share gmail.com)", async () => {
    f = await fixture(5);
    await sql`update leads set email = 'person' || id || '@gmail.com' where workspace_id = ${f.workspaceId}`;
    process.env.SEND_DOMAIN_HOURLY_LIMIT = "2";
    await runSends();
    expect(mail().delivered).toHaveLength(5);
  });

  it("spacing: emails from one mailbox are not sent back-to-back", async () => {
    f = await fixture(4);
    process.env.SEND_SPACING_SECONDS = "3600";
    await runSends();
    expect(mail().delivered).toHaveLength(1); // the rest wait for a jittered gap (30–90 minutes)
    await tick(f.workspaceId, true); // (jobs that lost the same-batch race are re-gated here)
    expect(mail().delivered).toHaveLength(1);
    const waits = await sql`select run_at > now() + interval '20 minutes' as later from jobs where workspace_id = ${f.workspaceId} and status = 'queued'`;
    expect(waits).toHaveLength(3);
    expect(waits.every((w) => w.later === true)).toBe(true);
  });

  it("never exceeds a limit even when many jobs are claimed in the same tick", async () => {
    f = await fixture(40, { mailboxDailyLimit: 7 });
    await runSends();
    await runSends();
    expect(mail().delivered).toHaveLength(7);
    expect((await messages(f.workspaceId)).filter((m) => m.status !== "canceled")).toHaveLength(7);
  });
});

describe("provider errors", () => {
  it("rate limited (429) → retried with backoff, then succeeds — one email, no duplicate", async () => {
    f = await fixture();
    mail().failNext(new MailProviderError("Too many requests", "rate_limited", "rate_limit_exceeded", 1), 2);
    await runSends({ retryBackoff: true });
    await tick(f.workspaceId, true);
    await tick(f.workspaceId, true);
    expect(mail().requests).toHaveLength(3);
    expect(mail().delivered).toHaveLength(1);
    expect((await send(f.sends[0])).status).toBe("sent");
  });

  it("a permanent rejection fails only that email and keeps the campaign running", async () => {
    f = await fixture(2);
    mail().failNext(new MailProviderError("Invalid `to` field", "permanent", "validation_error"), 1);
    await runSends({ retryBackoff: true });
    const [failed, ok] = [await send(f.sends[0]), await send(f.sends[1])];
    expect(failed.status).toBe("failed");
    expect(ok.status).toBe("sent");
    expect(mail().requests).toHaveLength(2); // the rejected one was NOT retried
    const [c] = await sql`select status, sent_count from campaigns where id = ${f.campaignId}`;
    expect(c).toMatchObject({ status: "running" });
    expect(Number(c.sent_count)).toBe(1);
  });

  it.each([
    ["auth", "The email provider rejected our credentials"],
    ["domain", "The email provider rejected the sending domain"],
  ] as const)("a %s error pauses the whole campaign with a reason, and nothing is lost", async (cls, reasonStart) => {
    f = await fixture(3);
    mail().failNext(new MailProviderError("bad", cls, cls === "auth" ? "invalid_api_key" : "domain_not_verified"), 3); // every call fails, as with a real bad key
    await runSends({ retryBackoff: true });
    const [c] = await sql`select status, paused_reason from campaigns where id = ${f.campaignId}`;
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toContain(reasonStart);
    expect((await sql`select 1 from campaign_sends where campaign_id = ${f.campaignId} and status = 'pending'`)).toHaveLength(3); // all still pending
    expect(mail().delivered).toHaveLength(0);

    // Fixed → resume → everything goes out once.
    await sql`update campaigns set status = 'running', paused_reason = null where id = ${f.campaignId}`;
    await runSends({ retryBackoff: true });
    expect(mail().delivered).toHaveLength(3);
  });

  it("no provider API key: the campaign pauses with a clear reason BEFORE anything is claimed or retried", async () => {
    f = await fixture(2);
    mail().configured = false;
    await runSends({ retryBackoff: true });
    const [c] = await sql`select status, paused_reason from campaigns where id = ${f.campaignId}`;
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(/isn't configured/);
    expect(mail().requests).toHaveLength(0);
    expect(await messages(f.workspaceId)).toHaveLength(0); // no orphaned `sending` rows
    expect((await sql`select 1 from campaign_sends where campaign_id = ${f.campaignId} and status = 'pending'`)).toHaveLength(2);
  });

  it("retries that never succeed end as a visible failure — and a burst of them pauses the campaign as an outage", async () => {
    f = await fixture(5);
    mail().failNext(new MailProviderError("upstream 500", "retryable", "internal_server_error"), 1000);
    await runSends({ retryBackoff: true, maxTicks: 30 });
    const failed = await sql`select status, error_class from messages where workspace_id = ${f.workspaceId}`;
    expect(failed.filter((m) => m.status === "failed")).toHaveLength(5);
    const [c] = await sql`select status, paused_reason from campaigns where id = ${f.campaignId}`;
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(/provider problem/);
  });
});

describe("operator tools for failed sends", () => {
  beforeEach(async () => {
    f = await fixture(1);
    mail().failNext(new MailProviderError("Invalid `to` field", "permanent"), 1);
    await runSends({ retryBackoff: true });
    expect((await send(f.sends[0])).status).toBe("failed");
  });

  it("retry re-queues the email and it goes out once", async () => {
    await retryFailedSend(f.workspaceId, null, f.sends[0]);
    await runSends({ retryBackoff: true });
    expect((await send(f.sends[0])).status).toBe("sent");
    expect(mail().delivered).toHaveLength(1);
  });

  it("skip drops the email and sends nothing", async () => {
    await skipFailedSend(f.workspaceId, null, f.sends[0]);
    await runSends();
    expect((await send(f.sends[0])).status).toBe("canceled");
    expect(mail().delivered).toHaveLength(0);
  });

  it("refuses to act on a send that is not failed, or that belongs to another workspace", async () => {
    await retryFailedSend(f.workspaceId, null, f.sends[0]);
    await expect(retryFailedSend(f.workspaceId, null, f.sends[0])).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await createWorkspace();
    await expect(skipFailedSend(other.workspaceId, null, f.sends[0])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("unsubscribe (RFC 8058 one-click)", () => {
  it("a POST to the List-Unsubscribe URL suppresses the recipient and cancels their pending emails", async () => {
    f = await fixture(2);
    await runSends({ maxTicks: 1 }); // first email goes out with its headers
    const sent = mail().delivered[0];
    expect(sent.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const url = String(sent.headers?.["List-Unsubscribe"]).replace(/^<|>$/g, "");
    const res = await unsubscribePost(new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(res.status).toBe(200);
    const dnc = await sql`select source from do_not_contact where workspace_id = ${f.workspaceId} and lower(email) = ${sent.to.toLowerCase()}`;
    expect(dnc).toHaveLength(1);

    const bad = await unsubscribePost(new Request(buildUnsubscribeUrl("http://localhost:3000", f.workspaceId + 1, sent.to), { method: "POST" }));
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  it("a recipient who unsubscribed after enrollment is never emailed", async () => {
    f = await fixture(1);
    await sql`insert into do_not_contact (workspace_id, email) values (${f.workspaceId}, ${f.leads[0].email})`;
    await runSends();
    expect(mail().requests).toHaveLength(0);
    expect((await send(f.sends[0])).status).toBe("blocked");
  });
});

describe("tenant isolation of the sender", () => {
  it("a workspace-scoped worker never sends another workspace's email", async () => {
    f = await fixture(2);
    const other = await fixture(2);
    await runSends({ workspaceId: f.workspaceId });
    expect(mail().delivered).toHaveLength(2);
    expect((await sql`select 1 from messages where workspace_id = ${other.workspaceId}`)).toHaveLength(0);
    expect((await messages(f.workspaceId)).every((m) => Number(m.workspace_id) === f.workspaceId)).toBe(true);
  });

  it("a job can't be used to send another workspace's send", async () => {
    f = await fixture(1);
    const other = await createWorkspace();
    await enqueueSend(other.workspaceId, f.sends[0], "cross-tenant");
    await tick(other.workspaceId);
    expect(mail().requests).toHaveLength(0);
    expect((await send(f.sends[0])).status).toBe("pending");
  });
});

describe("load: 1,000 recipients", () => {
  it("drains across ticks — every recipient exactly once, limits respected, nothing left behind", async () => {
    f = await fixture(1000);
    const started = Date.now();
    const res = await runSends({ maxTicks: 60 });
    expect(res).toMatchObject({ processed: 1000, sent: 1000, failed: 0, pending: 0 });
    expect(mail().delivered).toHaveLength(1000);
    expect(new Set(mail().delivered.map((d) => d.to)).size).toBe(1000);
    const [m] = await sql`select count(*)::int as n, count(distinct campaign_send_id)::int as d, count(distinct provider_message_id)::int as p from messages where workspace_id = ${f.workspaceId} and status = 'sent'`;
    expect(m).toMatchObject({ n: 1000, d: 1000, p: 1000 });
    const [c] = await sql`select sent_count from campaigns where id = ${f.campaignId}`;
    expect(Number(c.sent_count)).toBe(1000);
    console.info(`[load] 1000 sends drained in ${((Date.now() - started) / 1000).toFixed(1)}s over ${res.ticks} ticks`);
  }, 240_000);
});
