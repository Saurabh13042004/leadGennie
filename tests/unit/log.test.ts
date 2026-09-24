import { afterEach, describe, expect, it } from "vitest";
import { createLogger, setLogSink } from "@/lib/log";

afterEach(() => setLogSink(null));

describe("structured logger", () => {
  it("emits one JSON line with base fields, level and timestamp", () => {
    const out: string[] = [];
    setLogSink((l) => out.push(l));
    createLogger({ request_id: "r1" }).child({ workspace_id: 7 }).info("thing.happened", { n: 1 });
    const line = JSON.parse(out[0]);
    expect(line).toMatchObject({ level: "info", msg: "thing.happened", request_id: "r1", workspace_id: 7, n: 1 });
    expect(new Date(line.ts).getTime()).not.toBeNaN();
  });

  it("redacts credentials at any depth", () => {
    const out: string[] = [];
    setLogSink((l) => out.push(l));
    createLogger().info("x", {
      password: "hunter2",
      headers: { authorization: "Bearer abc", "x-api-key": "k" },
      nested: { deep: { access_token: "t", ok: "visible" } },
    });
    expect(out[0]).not.toContain("hunter2");
    expect(out[0]).not.toContain("Bearer abc");
    expect(out[0]).not.toContain('"t"');
    expect(out[0]).toContain("visible");
    expect(out[0]).toContain("[redacted]");
  });

  it("serializes Error instances (message + stack)", () => {
    const out: string[] = [];
    setLogSink((l) => out.push(l));
    createLogger().error("boom", { err: new Error("kaput") });
    const line = JSON.parse(out[0]);
    expect(line.err.message).toBe("kaput");
    expect(line.err.stack).toContain("kaput");
  });
});
