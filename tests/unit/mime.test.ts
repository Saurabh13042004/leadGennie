import { describe, expect, it } from "vitest";
import { buildMime, encodeWords, MimeError, toBase64Url } from "@/lib/email/mime";

const base = { from: { email: "me@acme.com", name: "Ada Lovelace" }, to: ["lead@example.org"], subject: "Hello", text: "Hi there" };
const decodeBody = (mime: string) => {
  const b64 = mime.split("\r\n\r\n")[1].replace(/\r\n/g, "");
  return Buffer.from(b64, "base64").toString("utf8");
};

describe("buildMime", () => {
  it("writes a plain-text message with the headers a mail client needs", () => {
    const mime = buildMime({ ...base, date: new Date("2026-01-02T03:04:05Z") });
    expect(mime).toContain('From: "Ada Lovelace" <me@acme.com>');
    expect(mime).toContain("To: lead@example.org");
    expect(mime).toContain("Subject: Hello");
    expect(mime).toContain("Date: Fri, 02 Jan 2026 03:04:05 GMT");
    expect(mime).toContain("MIME-Version: 1.0");
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(decodeBody(mime)).toBe("Hi there");
    expect(mime.split("\r\n").every((l) => l.length <= 998)).toBe(true);
  });

  it("passes List-Unsubscribe through and threads a reply", () => {
    const mime = buildMime({ ...base, headers: { "List-Unsubscribe": "<https://x.test/u>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }, inReplyTo: "<a@b>", references: ["<z@b>", "<a@b>"] });
    expect(mime).toContain("List-Unsubscribe: <https://x.test/u>");
    expect(mime).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(mime).toContain("In-Reply-To: <a@b>");
    expect(mime).toContain("References: <z@b> <a@b>");
  });

  it("encodes non-ASCII subjects and bodies as UTF-8 (and keeps them decodable)", () => {
    const mime = buildMime({ ...base, subject: "Grüße — 你好", text: "Café ☕" });
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(decodeBody(mime)).toBe("Café ☕");
    const words = encodeWords("é".repeat(60)).split("\r\n ");
    expect(words.length).toBeGreaterThan(1);
    expect(words.every((w) => w.length <= 75)).toBe(true); // RFC 2047 encoded-word limit
    expect(words.map((w) => Buffer.from(w.slice(10, -2), "base64").toString("utf8")).join("")).toBe("é".repeat(60));
  });

  it("builds multipart/alternative when there is HTML", () => {
    const mime = buildMime({ ...base, html: "<p>Hi</p>" });
    expect(mime).toMatch(/Content-Type: multipart\/alternative; boundary="lg_[0-9a-f]+"/);
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).toContain("Content-Type: text/html; charset=UTF-8");
  });

  it("supports cc, bcc and reply-to", () => {
    const mime = buildMime({ ...base, cc: ["c@x.io"], bcc: ["b@x.io"], replyTo: "reply@acme.com" });
    expect(mime).toContain("Cc: c@x.io");
    expect(mime).toContain("Bcc: b@x.io");
    expect(mime).toContain("Reply-To: reply@acme.com");
  });

  it.each([
    ["a line break in the subject", { subject: "Hi\r\nBcc: victim@x.io" }],
    ["a line break in the display name", { from: { email: "me@acme.com", name: "Ada\nBcc: x@y.z" } }],
    ["a line break in a header value", { headers: { "X-Note": "a\r\nInjected: 1" } }],
    ["an address that is not an address", { to: ["lead@example.org>, evil@x.io"] }],
    ["an address with a newline", { to: ["lead@example.org\nBcc: x@y.z"] }],
    ["a header name with a colon", { headers: { "X-A: b": "c" } }],
    ["a caller trying to set From", { headers: { From: "boss@acme.com" } }],
    ["no recipients", { to: [] }],
  ])("refuses %s (header injection / bad input)", (_n, over) => {
    expect(() => buildMime({ ...base, ...over })).toThrow(MimeError);
  });

  it("base64url has no padding or +/", () => {
    expect(toBase64Url("???>>>")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
