import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";

import { POST as resendWebhook } from "@/app/api/webhooks/resend/route";
import { GET as cron } from "@/app/api/cron/send-campaigns/route";

const SECRET = `whsec_${Buffer.from("test-webhook-secret-bytes").toString("base64")}`;

function signedRequest(event: unknown, overrides: { signature?: string } = {}) {
  const payload = JSON.stringify(event);
  const id = "msg_1";
  const ts = new Date();
  const wh = new Webhook(SECRET);
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    body: payload,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)),
      "webhook-signature": overrides.signature ?? wh.sign(id, ts, payload),
    },
  });
}

let workspaceId: number;
let leadEmail: string;
beforeEach(async () => {
  await resetDb();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  const ws = await createWorkspace();
  workspaceId = ws.workspaceId;
  const lead = await createLead(workspaceId, { email: "bounce@example.com" });
  leadEmail = lead.email as string;
  const [campaign] = await sql`insert into campaigns (workspace_id, name) values (${workspaceId}, 'C') returning id`;
  const [step] = await sql`insert into campaign_steps (campaign_id, step_order, channel) values (${campaign.id}, 1, 'email') returning id`;
  const [send] = await sql`
    insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, body, provider_message_id)
    values (${workspaceId}, ${campaign.id}, ${lead.id}, ${step.id}, 'email', 'sent', now(), 'x', 'email_123') returning id`;
  // The message record the sender writes before calling the provider — webhooks correlate on its provider id.
  await sql`
    insert into messages (workspace_id, campaign_id, campaign_send_id, lead_id, from_email, to_email, to_domain, provider_message_id, idempotency_key, status, attempts)
    values (${workspaceId}, ${campaign.id}, ${send.id}, ${lead.id}, 'me@x.example', ${lead.email}, 'example.com', 'email_123', 'k1', 'sent', 1)`;
});
afterEach(() => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  delete process.env.CRON_SECRET;
});

const dnc = () => sql`select reason, source from do_not_contact where workspace_id = ${workspaceId}`;
const bounce = (type: string) => ({ type: "email.bounced", data: { email_id: "email_123", to: [leadEmail], bounce: { type } } });

describe("Resend webhook (DEL-03)", () => {
  it("a permanent bounce suppresses the recipient in the sending workspace", async () => {
    const res = await resendWebhook(signedRequest(bounce("Permanent")), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, suppressed: true });
    const rows = await dnc();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: "Hard bounce", source: "resend_webhook" });
  });

  it("a spam complaint suppresses", async () => {
    await resendWebhook(signedRequest({ type: "email.complained", data: { email_id: "email_123", to: [leadEmail] } }), undefined);
    expect((await dnc())[0].reason).toBe("Spam complaint");
  });

  it("a transient bounce does NOT suppress", async () => {
    const res = await resendWebhook(signedRequest(bounce("Transient")), undefined);
    expect(await res.json()).toMatchObject({ suppressed: false });
    expect(await dnc()).toHaveLength(0);
  });

  it("an event we can't correlate to a send changes nothing", async () => {
    const res = await resendWebhook(
      signedRequest({ type: "email.bounced", data: { email_id: "unknown", to: [leadEmail], bounce: { type: "Permanent" } } }),
      undefined,
    );
    expect(await res.json()).toMatchObject({ ok: true, correlated: false });
    expect(await dnc()).toHaveLength(0);
  });

  it("ignores event types that are not about an email", async () => {
    const res = await resendWebhook(signedRequest({ type: "domain.updated", data: { id: "d1" } }), undefined);
    expect(await res.json()).toMatchObject({ ok: true, ignored: "domain.updated" });
  });

  it("records a delivery confirmation and moves the message forward", async () => {
    const res = await resendWebhook(signedRequest({ type: "email.delivered", data: { email_id: "email_123", to: [leadEmail] } }), undefined);
    expect(await res.json()).toMatchObject({ ok: true, correlated: true });
    const [m] = await sql`select status, delivered_at from messages where workspace_id = ${workspaceId} and provider_message_id = 'email_123'`;
    expect(m.status).toBe("delivered");
    expect(m.delivered_at).not.toBeNull();
    expect(await dnc()).toHaveLength(0);
  });

  it("rejects a bad signature with 401 and suppresses nothing", async () => {
    const res = await resendWebhook(signedRequest(bounce("Permanent"), { signature: "v1,bogus" }), undefined);
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHENTICATED");
    expect(await dnc()).toHaveLength(0);
  });

  it("rejects missing signature headers", async () => {
    const res = await resendWebhook(new Request("http://localhost/x", { method: "POST", body: "{}" }), undefined);
    expect(res.status).toBe(401);
  });

  it("reports NOT_CONFIGURED (503) when the secret is unset", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await resendWebhook(signedRequest(bounce("Permanent")), undefined);
    expect(res.status).toBe(503);
  });
});

describe("cron route auth", () => {
  const req = (auth?: string) =>
    new Request("http://localhost/api/cron/send-campaigns", { headers: auth ? { authorization: auth } : {} });

  it("503 when CRON_SECRET is not configured", async () => {
    expect((await cron(req("Bearer x"), undefined)).status).toBe(503);
  });

  it("401 for a missing or wrong secret (same length or not)", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(req(), undefined)).status).toBe(401);
    expect((await cron(req("Bearer nope"), undefined)).status).toBe(401);
    expect((await cron(req("Bearer s3creT"), undefined)).status).toBe(401);
  });

  it("200 with the right secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await cron(req("Bearer s3cret"), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
