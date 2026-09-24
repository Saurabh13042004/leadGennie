import { describe, expect, it } from "vitest";
import { classifyEmail, corporateDomainFromEmail, isValidEmailSyntax, normalizeEmail } from "@/lib/domain/leads/email";
import { DnsMxResolver, resolveDomains } from "@/lib/domain/leads/mx";

describe("classifyEmail — status table", () => {
  const cases: [string, string, string[]][] = [
    // input, status, flags
    ["jane@acme.com", "unverified", []],
    ["Jane.Doe+news@Acme.COM", "unverified", []],
    ["jane@gmail.com", "unverified", ["free_mail"]],
    ["info@acme.com", "risky", ["role_account"]],
    ["noreply@acme.com", "risky", ["role_account"]],
    ["no-reply@acme.com", "risky", ["role_account"]],
    ["support+eu@acme.com", "risky", ["role_account"]],
    ["sales@gmail.com", "risky", ["role_account", "free_mail"]],
    ["someone@mailinator.com", "risky", ["disposable"]],
    ["info@guerrillamail.com", "risky", ["disposable", "role_account"]],
    ["not-an-email", "invalid", ["invalid_syntax"]],
    ["a@b", "invalid", ["invalid_syntax"]],
    ["@acme.com", "invalid", ["invalid_syntax"]],
    ["jane@@acme.com", "invalid", ["invalid_syntax"]],
    ["jane doe@acme.com", "invalid", ["invalid_syntax"]],
    ["jane..doe@acme.com", "invalid", ["invalid_syntax"]],
    [".jane@acme.com", "invalid", ["invalid_syntax"]],
    ["jane@-acme.com", "invalid", ["invalid_syntax"]],
    ["jane@acme.c", "invalid", ["invalid_syntax"]],
    ["jane@[127.0.0.1]", "invalid", ["invalid_syntax"]],
  ];
  it.each(cases)("%s → %s", (input, status, flags) => {
    const r = classifyEmail(input);
    expect(r.status).toBe(status);
    expect([...r.flags].sort()).toEqual([...flags].sort());
  });

  it("empty input is 'unverified' with no email and no flags (a missing email is not an invalid one)", () => {
    for (const v of ["", "  ", null, undefined]) {
      expect(classifyEmail(v)).toMatchObject({ email: null, status: "unverified", flags: [] });
    }
  });

  it("normalizes case, whitespace, mailto: and <angle> forms", () => {
    expect(normalizeEmail("  MAILTO:Jane@Acme.com ")).toBe("jane@acme.com");
    expect(normalizeEmail("Jane Doe <jane@acme.com>")).toBe("jane@acme.com");
  });

  it("gives human-readable reasons for risky/invalid, none for free-mail", () => {
    expect(classifyEmail("info@acme.com").reasons.join()).toMatch(/role account/i);
    expect(classifyEmail("x@mailinator.com").reasons.join()).toMatch(/disposable/i);
    expect(classifyEmail("bad").reasons.join()).toMatch(/valid email/i);
    expect(classifyEmail("jane@gmail.com").reasons).toEqual([]);
  });

  it("rejects over-long addresses", () => {
    expect(isValidEmailSyntax(`${"a".repeat(65)}@acme.com`)).toBe(false);
    expect(isValidEmailSyntax(`a@${"b".repeat(250)}.com`)).toBe(false);
  });
});

describe("classifyEmail — MX result", () => {
  it("has_mx upgrades a clean address to valid, but never rescues a risky one", () => {
    expect(classifyEmail("jane@acme.com", { mx: "has_mx" }).status).toBe("valid");
    expect(classifyEmail("info@acme.com", { mx: "has_mx" }).status).toBe("risky");
  });
  it("no_mx makes anything invalid; unknown changes nothing", () => {
    expect(classifyEmail("jane@dead.com", { mx: "no_mx" })).toMatchObject({ status: "invalid", flags: ["no_mx"] });
    expect(classifyEmail("info@dead.com", { mx: "no_mx" }).status).toBe("invalid");
    expect(classifyEmail("jane@acme.com", { mx: "unknown" }).status).toBe("unverified");
  });
});

describe("corporateDomainFromEmail", () => {
  it("excludes free-mail and disposable providers", () => {
    expect(corporateDomainFromEmail("jane@acme.com")).toBe("acme.com");
    expect(corporateDomainFromEmail("jane@gmail.com")).toBeNull();
    expect(corporateDomainFromEmail("jane@yahoo.co.uk")).toBeNull();
    expect(corporateDomainFromEmail("jane@mailinator.com")).toBeNull();
    expect(corporateDomainFromEmail(null)).toBeNull();
  });
});

describe("DnsMxResolver", () => {
  it("caches definite answers and never caches 'unknown'", async () => {
    let calls = 0;
    let mode: "ok" | "servfail" = "servfail";
    const r = new DnsMxResolver(async () => {
      calls++;
      if (mode === "servfail") throw Object.assign(new Error("x"), { code: "ESERVFAIL" });
      return [{ exchange: "mx.acme.com" }];
    });
    expect(await r.resolve("acme.com")).toBe("unknown");
    mode = "ok";
    expect(await r.resolve("acme.com")).toBe("has_mx");
    expect(await r.resolve("ACME.com")).toBe("has_mx");
    expect(calls).toBe(2);
  });

  it("NXDOMAIN/NODATA → no_mx; RFC 7505 null MX → no_mx; other DNS errors → unknown (never a false 'invalid')", async () => {
    const codes: Record<string, () => Promise<{ exchange: string }[]>> = {
      "gone.com": async () => { throw Object.assign(new Error(), { code: "ENOTFOUND" }); },
      "nodata.com": async () => { throw Object.assign(new Error(), { code: "ENODATA" }); },
      "nullmx.com": async () => [{ exchange: "." }],
      "flaky.com": async () => { throw Object.assign(new Error(), { code: "ETIMEOUT" }); },
    };
    const r = new DnsMxResolver((d) => codes[d]());
    const out = await resolveDomains(r, Object.keys(codes));
    expect(Object.fromEntries(out)).toEqual({ "gone.com": "no_mx", "nodata.com": "no_mx", "nullmx.com": "no_mx", "flaky.com": "unknown" });
  });
});
