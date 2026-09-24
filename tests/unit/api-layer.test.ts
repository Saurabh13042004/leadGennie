import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, fail, ok, parseJson, toResponse, withApi } from "@/lib/api";
import { setLogSink } from "@/lib/log";

let lines: string[] = [];
beforeEach(() => {
  lines = [];
  setLogSink((line) => lines.push(line));
});
afterEach(() => setLogSink(null));

const post = (body: unknown, raw = false) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("response envelope", () => {
  it("ok() is additive: ok:true plus the fields", async () => {
    expect(await ok({ items: [1] }).json()).toEqual({ ok: true, items: [1] });
    expect(await ok().json()).toEqual({ ok: true });
  });

  it("fail() carries a string `error` (legacy clients), a stable `code`, and the status", async () => {
    const res = fail("NOT_FOUND", "Nope", { requestId: "r1" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Nope", code: "NOT_FOUND", request_id: "r1" });
  });
});

describe("withApi", () => {
  const Body = z.object({ name: z.string().min(1, "Name is required."), age: z.number().optional() });

  it("passes success through and stamps x-request-id", async () => {
    const h = withApi(async (req) => ok({ got: (await parseJson(req, Body)).name }));
    const res = await h(post({ name: "ada" }), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await res.json()).toEqual({ ok: true, got: "ada" });
  });

  it("honours an incoming x-request-id", async () => {
    const h = withApi(async () => ok());
    const req = new Request("http://localhost/x", { headers: { "x-request-id": "abc-123" } });
    expect((await h(req, undefined)).headers.get("x-request-id")).toBe("abc-123");
  });

  it("invalid JSON → 400 BAD_REQUEST", async () => {
    const h = withApi(async (req) => ok(await parseJson(req, Body)));
    const res = await h(post("{not json", true), undefined);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("BAD_REQUEST");
  });

  it("schema failure → 422 with the first message as `error` and per-field details", async () => {
    const h = withApi(async (req) => ok(await parseJson(req, Body)));
    const res = await h(post({ name: "", age: "x" }), undefined);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.error).toBe("Name is required.");
    expect(json.details.map((d: { path: string }) => d.path).sort()).toEqual(["age", "name"]);
  });

  it("AppError keeps its code/status/message", async () => {
    const h = withApi(async () => {
      throw new AppError("CONFLICT", "Already exists");
    });
    const res = await h(post({}), undefined);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, error: "Already exists", code: "CONFLICT" });
  });

  it("an unexpected error NEVER leaks its message or stack — and is logged with the request id", async () => {
    const h = withApi(async () => {
      throw new Error("connection to db-prod-internal.neon.tech refused at /srv/app/lib/db.ts:42");
    });
    const res = await h(post({}), undefined);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("db-prod-internal");
    expect(text).not.toContain("/srv/app");
    expect(text).not.toMatch(/\bat \w+/); // no stack frames
    const json = JSON.parse(text);
    expect(json).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });

    const logged = JSON.parse(lines.find((l) => l.includes("api.unhandled_error"))!);
    expect(logged.request_id).toBe(json.request_id);
    expect(logged.err.message).toContain("db-prod-internal"); // full detail lives in the log only
    expect(logged.level).toBe("error");
  });

  it("extraHeaders (CORS) are applied to success AND error responses", async () => {
    const h = withApi(async (req) => ok(await parseJson(req, Body)), { extraHeaders: { "Access-Control-Allow-Origin": "*" } });
    expect((await h(post({ name: "a" }), undefined)).headers.get("access-control-allow-origin")).toBe("*");
    expect((await h(post({ name: "" }), undefined)).headers.get("access-control-allow-origin")).toBe("*");
  });

  it("toResponse maps a raw ZodError", async () => {
    const parsed = z.object({ a: z.string() }).safeParse({});
    const res = toResponse(parsed.error);
    expect(res.status).toBe(422);
  });
});

describe("required-field messages", () => {
  it("a missing field says '<X> is required', not the library default", async () => {
    const { POST } = await import("@/app/api/book-demo/route");
    const res = await POST(post({ name: "A" }), undefined);
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.details.map((d: { message: string }) => d.message).sort()).toEqual(["Company is required.", "Email is required."]);
  });
});
