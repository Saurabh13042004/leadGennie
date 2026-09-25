import { describe, expect, it } from "vitest";
import { DEFAULT_GATE_CONFIG, effectiveMailboxLimit, evaluateGate, gateConfigFromEnv, jitterFactor, type GateInput } from "@/lib/domain/sending/gate";
import { isWindowOpen, localDayStart, nextLocalDayStart, nextWindowOpen } from "@/lib/domain/campaigns/schedule";
import { classifyResendError } from "@/lib/email/resend-provider";
import { FakeMailProvider } from "@/lib/email/fake-provider";
import { MailProviderError, isSystemic } from "@/lib/email/provider";
import { complianceHeaders } from "@/lib/domain/sending/identity";
import { hasSenderIdentity, unsubscribeFooter } from "@/lib/campaigns/render";
import { MAX_JOB_GENERATIONS } from "@/lib/domain/sending/scheduler";
import type { SendWindow } from "@/lib/domain/campaigns/types";

const WEEKDAYS: SendWindow = { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: "UTC" };
// 2026-09-23 is a Wednesday.
const wed10 = new Date("2026-09-23T10:00:00Z");

const base = (over: Partial<GateInput> = {}): GateInput => ({
  now: wed10, window: WEEKDAYS, campaignTimezone: "UTC", campaignDailyLimit: 50, mailboxDailyLimit: 100,
  mailboxCreatedAt: new Date("2026-01-01T00:00:00Z"), workspaceDailyCap: null, recipientDomain: "acme.example", seed: 7,
  counts: { campaignToday: 0, mailboxToday: 0, workspaceToday: 0, domainLastHour: 0, mailboxLastClaimAt: null },
  config: { ...DEFAULT_GATE_CONFIG, spacingSeconds: 0 }, ...over,
});
const withCounts = (c: Partial<GateInput["counts"]>) => base({ counts: { ...base().counts, ...c } });

describe("SendGate: each rule, in its fixed order", () => {
  it("sends when everything has room, and reports the limits the atomic claim must re-verify", () => {
    const d = evaluateGate(base());
    expect(d).toMatchObject({ kind: "send", limits: { campaign: 50, mailbox: 100, workspace: null, domainHourly: 10 } });
  });

  it("outside the send window: defers to the next window open (Saturday → Monday 09:00)", () => {
    const sat = new Date("2026-09-26T12:00:00Z");
    const d = evaluateGate(base({ now: sat }));
    expect(d).toMatchObject({ kind: "defer", reason: "outside_window" });
    if (d.kind === "defer") expect(d.until.toISOString()).toBe("2026-09-28T09:00:00.000Z");
  });

  it("no window (legacy campaigns) means always open", () => {
    expect(evaluateGate(base({ window: null, now: new Date("2026-09-26T03:00:00Z") })).kind).toBe("send");
  });

  it("campaign daily limit: defers to the start of the campaign's NEXT local day", () => {
    const d = evaluateGate(withCounts({ campaignToday: 50 }));
    expect(d).toMatchObject({ kind: "defer", reason: "campaign_daily_limit" });
    if (d.kind === "defer") expect(d.until.toISOString()).toBe("2026-09-24T00:00:00.000Z");
    const ist = evaluateGate({ ...withCounts({ campaignToday: 50 }), campaignTimezone: "Asia/Kolkata" });
    if (ist.kind === "defer") expect(ist.until.toISOString()).toBe("2026-09-23T18:30:00.000Z"); // midnight IST
  });

  it("mailbox daily limit and workspace cap reset at UTC midnight", () => {
    const m = evaluateGate(withCounts({ mailboxToday: 100 }));
    expect(m).toMatchObject({ kind: "defer", reason: "mailbox_daily_limit" });
    const w = evaluateGate({ ...withCounts({ workspaceToday: 30 }), workspaceDailyCap: 30 });
    expect(w).toMatchObject({ kind: "defer", reason: "workspace_daily_cap" });
    if (w.kind === "defer") expect(w.until.toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });

  it("per-recipient-domain throttle defers 10 minutes — but never for free-mail domains", () => {
    const d = evaluateGate(withCounts({ domainLastHour: 10 }));
    expect(d).toMatchObject({ kind: "defer", reason: "domain_throttle" });
    if (d.kind === "defer") expect(d.until.getTime() - wed10.getTime()).toBe(600_000);
    expect(evaluateGate({ ...withCounts({ domainLastHour: 500 }), recipientDomain: "gmail.com" }).kind).toBe("send");
  });

  it("rule order: window beats limits, campaign beats mailbox beats workspace beats domain", () => {
    const all = { campaignToday: 99, mailboxToday: 999, workspaceToday: 999, domainLastHour: 99 };
    expect(evaluateGate({ ...withCounts(all), workspaceDailyCap: 1, now: new Date("2026-09-26T12:00:00Z") })).toMatchObject({ reason: "outside_window" });
    expect(evaluateGate({ ...withCounts(all), workspaceDailyCap: 1 })).toMatchObject({ reason: "campaign_daily_limit" });
    expect(evaluateGate({ ...withCounts({ ...all, campaignToday: 0 }), workspaceDailyCap: 1 })).toMatchObject({ reason: "mailbox_daily_limit" });
    expect(evaluateGate({ ...withCounts({ ...all, campaignToday: 0, mailboxToday: 0 }), workspaceDailyCap: 1 })).toMatchObject({ reason: "workspace_daily_cap" });
    expect(evaluateGate(withCounts({ ...all, campaignToday: 0, mailboxToday: 0, workspaceToday: 0 }))).toMatchObject({ reason: "domain_throttle" });
  });
});

describe("SendGate: spacing (no bursts)", () => {
  const spaced = (last: Date | null, seed = 7) =>
    base({ config: { ...DEFAULT_GATE_CONFIG, spacingSeconds: 60 }, seed, counts: { ...base().counts, mailboxLastClaimAt: last } });

  it("defers until last send + a jittered gap; sends once the gap has passed", () => {
    const d = evaluateGate(spaced(new Date(wed10.getTime() - 1000)));
    expect(d).toMatchObject({ kind: "defer", reason: "spacing" });
    if (d.kind === "defer") expect(d.until.getTime()).toBeGreaterThan(wed10.getTime());
    expect(evaluateGate(spaced(new Date(wed10.getTime() - 120_000))).kind).toBe("send"); // 2 min > max jitter (90 s)
    expect(evaluateGate(spaced(null)).kind).toBe("send");
  });

  it("the gap is jittered between 0.5x and 1.5x, deterministically per send", () => {
    const gaps = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const f = jitterFactor(seed);
      expect(f).toBeGreaterThanOrEqual(0.5);
      expect(f).toBeLessThan(1.5);
      expect(jitterFactor(seed)).toBe(f);
      gaps.add(Math.round(60 * f));
    }
    expect(gaps.size).toBeGreaterThan(20); // genuinely spread, not one constant
  });
});

describe("mailbox warm-up ramp", () => {
  const created = new Date("2026-09-23T00:00:00Z");
  const at = (days: number) => new Date(created.getTime() + days * 86_400_000 + 3_600_000);
  it("caps a new mailbox and grows 1.5x a day until it reaches its configured limit", () => {
    expect([0, 1, 2, 3, 4, 5].map((d) => effectiveMailboxLimit(1000, created, at(d)))).toEqual([15, 23, 34, 51, 76, 114]);
    expect(effectiveMailboxLimit(80, created, at(0))).toBe(15);
    expect(effectiveMailboxLimit(80, created, at(30))).toBe(80);
    expect(effectiveMailboxLimit(5, created, at(0))).toBe(5); // never above the configured limit
  });
  it("is explained when it is what stopped the send", () => {
    const d = evaluateGate({ ...base({ mailboxCreatedAt: wed10 }), counts: { ...base().counts, mailboxToday: 15 } });
    expect(d).toMatchObject({ kind: "defer", reason: "mailbox_daily_limit" });
    if (d.kind === "defer") expect(d.detail).toMatch(/warming up: 15\/day/);
  });
});

describe("gate config from the environment", () => {
  it("uses defaults, accepts sane overrides, ignores garbage", () => {
    expect(gateConfigFromEnv({})).toEqual(DEFAULT_GATE_CONFIG);
    expect(gateConfigFromEnv({ SEND_SPACING_SECONDS: "45", SEND_DOMAIN_HOURLY_LIMIT: "3" })).toMatchObject({ spacingSeconds: 45, domainHourlyLimit: 3 });
    expect(gateConfigFromEnv({ SEND_SPACING_SECONDS: "abc", SEND_DOMAIN_HOURLY_LIMIT: "0" })).toEqual(DEFAULT_GATE_CONFIG);
  });
});

describe("send window helpers", () => {
  it("local day boundaries follow the timezone", () => {
    expect(localDayStart(wed10, "UTC").toISOString()).toBe("2026-09-23T00:00:00.000Z");
    expect(localDayStart(new Date("2026-09-23T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe("2026-09-23T18:30:00.000Z"); // already the 24th in IST
    expect(nextLocalDayStart(wed10, "America/New_York").toISOString()).toBe("2026-09-24T04:00:00.000Z");
  });
  it("finds the next opening: later today, tomorrow, or after the weekend", () => {
    expect(isWindowOpen(wed10, WEEKDAYS)).toBe(true);
    expect(nextWindowOpen(wed10, WEEKDAYS)).toBe(wed10);
    expect(nextWindowOpen(new Date("2026-09-23T05:00:00Z"), WEEKDAYS).toISOString()).toBe("2026-09-23T09:00:00.000Z");
    expect(nextWindowOpen(new Date("2026-09-23T18:00:00Z"), WEEKDAYS).toISOString()).toBe("2026-09-24T09:00:00.000Z");
    expect(nextWindowOpen(new Date("2026-09-25T18:00:00Z"), WEEKDAYS).toISOString()).toBe("2026-09-28T09:00:00.000Z");
  });
});

describe("provider error classification (Resend's documented error codes)", () => {
  const c = (name: string, statusCode: number, message = "") => classifyResendError({ name, statusCode, message }).cls;
  it.each([
    ["invalid_api_key", 401, "", "auth"],
    ["missing_api_key", 401, "", "auth"],
    ["restricted_api_key", 401, "", "auth"],
    ["monthly_quota_exceeded", 429, "", "auth"],
    ["validation_error", 403, "The gennie.dev domain is not verified. Please, add and verify your domain.", "domain"],
    ["rate_limit_exceeded", 429, "", "rate_limited"],
    ["daily_quota_exceeded", 429, "", "quota"],
    ["concurrent_idempotent_requests", 409, "", "retryable"],
    ["invalid_idempotent_request", 409, "", "permanent"],
    ["internal_server_error", 500, "", "retryable"],
    ["application_error", 500, "", "retryable"],
    ["validation_error", 422, "Invalid `to` field", "permanent"],
    ["invalid_from_address", 422, "", "permanent"],
    ["something_new", 400, "", "permanent"],
    ["something_new", 503, "", "retryable"],
  ] as const)("%s (%i) → %s", (name, status, msg, cls) => {
    expect(c(name, status, msg)).toBe(cls);
  });
  it("only auth and domain errors are systemic (pause the campaign)", () => {
    expect(["auth", "domain"].every((k) => isSystemic(k as never))).toBe(true);
    expect(["retryable", "rate_limited", "quota", "permanent"].some((k) => isSystemic(k as never))).toBe(false);
  });
  it("rate limits carry a retry hint", () => {
    expect(classifyResendError({ name: "rate_limit_exceeded", statusCode: 429 }).retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("FakeMailProvider mirrors the provider's idempotency contract", () => {
  const input = { from: "a@x.example", to: "b@y.example", subject: "s", text: "t", idempotencyKey: "k1" };
  it("a replayed key returns the original id and does NOT deliver again", async () => {
    const mail = new FakeMailProvider();
    const a = await mail.send(input);
    const b = await mail.send(input);
    expect(b.id).toBe(a.id);
    expect(mail.requests).toHaveLength(2);
    expect(mail.delivered).toHaveLength(1);
    expect((await mail.send({ ...input, idempotencyKey: "k2" })).id).not.toBe(a.id);
  });
  it("a lost response delivers the email but throws; the replay returns the same id", async () => {
    const mail = new FakeMailProvider().loseNextResponse();
    await expect(mail.send(input)).rejects.toMatchObject({ cls: "retryable", code: "network_error" });
    expect(mail.delivered).toHaveLength(1);
    expect((await mail.send(input)).id).toBe(mail.delivered[0].id);
    expect(mail.delivered).toHaveLength(1);
  });
  it("scripted failures are consumed in order", async () => {
    const mail = new FakeMailProvider().failNext(new MailProviderError("slow down", "rate_limited"), 2);
    await expect(mail.send(input)).rejects.toThrow("slow down");
    await expect(mail.send(input)).rejects.toThrow("slow down");
    await expect(mail.send(input)).resolves.toMatchObject({ id: expect.any(String) });
  });
});

describe("compliance headers and footer", () => {
  it("RFC 8058 one-click headers", () => {
    expect(complianceHeaders("https://app.example/api/unsubscribe?w=1&e=a%40b.co&t=x")).toEqual({
      "List-Unsubscribe": "<https://app.example/api/unsubscribe?w=1&e=a%40b.co&t=x>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
  it("footer carries the sender's name and postal address above the unsubscribe link", () => {
    expect(unsubscribeFooter("https://u", { name: "Acme Inc", address: "1 Main St, Springfield" })).toBe("\n\n---\nAcme Inc\n1 Main St, Springfield\nUnsubscribe: https://u");
    expect(unsubscribeFooter("https://u")).toBe("\n\n---\nUnsubscribe: https://u");
    expect(unsubscribeFooter("https://u", { name: "  ", address: null })).toBe("\n\n---\nUnsubscribe: https://u");
  });
  it("identity needs BOTH a name and an address", () => {
    expect(hasSenderIdentity({ name: "A", address: "B" })).toBe(true);
    expect(hasSenderIdentity({ name: "A", address: " " })).toBe(false);
    expect(hasSenderIdentity(null)).toBe(false);
  });
});

describe("constants that bound retries", () => {
  it("a send gets a limited number of job generations before it is surfaced as failed", () => {
    expect(MAX_JOB_GENERATIONS).toBeGreaterThanOrEqual(2);
    expect(MAX_JOB_GENERATIONS).toBeLessThanOrEqual(5);
  });
});
