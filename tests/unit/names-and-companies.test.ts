import { describe, expect, it } from "vitest";
import { joinName, splitFullName } from "@/lib/domain/leads/names";
import { normalizeCompanyName, normalizeDomain, nameKeyFromDomain } from "@/lib/domain/companies/normalize";
import { planCompanyMatches, resolveIdentity, type ExistingCompany } from "@/lib/domain/companies/matcher";
import { linkedinSlug, normalizeLinkedinUrl } from "@/lib/domain/leads/urls";

describe("splitFullName", () => {
  const cases: [string, string | null, string | null][] = [
    ["Jane Doe", "Jane", "Doe"],
    ["  jane   doe ", "jane", "doe"],
    ["Cher", "Cher", null],
    ["Mary Jane Watson", "Mary Jane", "Watson"],
    ["Ludwig van Beethoven", "Ludwig", "van Beethoven"],
    ["Dr. Jane Doe", "Jane", "Doe"],
    ["Jane Doe Jr.", "Jane", "Doe"],
    ["Jane Doe, PhD", "Jane", "Doe"],
    ["Doe, Jane", "Jane", "Doe"],
    ["Mr Bean", "Bean", null],
    ["", null, null],
  ];
  it.each(cases)("%j → %j / %j", (input, first, last) => {
    expect(splitFullName(input)).toEqual({ firstName: first, lastName: last });
  });
  it("joinName skips blanks", () => {
    expect(joinName("Jane", null)).toBe("Jane");
    expect(joinName(" Jane ", " Doe ")).toBe("Jane Doe");
  });
});

describe("normalizeCompanyName — conservative", () => {
  const same: [string, string][] = [
    ["Acme Inc.", "acme"], ["ACME, Inc", "acme"], ["Acme LLC", "acme"], ["The Acme Company", "acme"],
    ["Acme Pvt. Ltd.", "acme"], ["Café Münch GmbH", "cafe munch"], ["Tom & Jerry Ltd", "tom and jerry"],
  ];
  it.each(same)("%s → %s", (a, b) => expect(normalizeCompanyName(a)).toBe(b));

  it("does NOT strip descriptive words, so distinct companies stay distinct", () => {
    expect(normalizeCompanyName("Dice Solutions")).not.toBe(normalizeCompanyName("Dice"));
    expect(normalizeCompanyName("Acme Technologies")).toBe("acme technologies");
  });
  it("keeps a name that is only a legal suffix; empty stays empty", () => {
    expect(normalizeCompanyName("Inc")).toBe("inc");
    expect(normalizeCompanyName("  ")).toBe("");
    expect(normalizeCompanyName(null)).toBe("");
  });
});

describe("normalizeDomain", () => {
  const cases: [string, string | null][] = [
    ["acme.com", "acme.com"], ["ACME.com", "acme.com"], ["https://www.Acme.com/about?x=1", "acme.com"],
    ["http://acme.co.uk:8080/", "acme.co.uk"], ["www2.acme.com", "acme.com"], ["jane@acme.com", "acme.com"],
    ["eng.acme.com", "eng.acme.com"], ["not a domain", null], ["localhost", null], ["", null], ["acme", null],
  ];
  it.each(cases)("%j → %j", (input, out) => expect(normalizeDomain(input)).toBe(out));
  it("nameKeyFromDomain uses the leading label", () => expect(nameKeyFromDomain("acme.co.uk")).toBe("acme"));
});

describe("LinkedIn URLs", () => {
  it("normalizes profile URLs and rejects everything else", () => {
    expect(normalizeLinkedinUrl("linkedin.com/in/janedoe/")).toBe("https://www.linkedin.com/in/janedoe");
    expect(normalizeLinkedinUrl("https://uk.linkedin.com/in/JaneDoe?trk=abc")).toBe("https://www.linkedin.com/in/JaneDoe");
    expect(normalizeLinkedinUrl("https://www.linkedin.com/company/acme")).toBeNull();
    expect(normalizeLinkedinUrl("https://evil.com/in/janedoe")).toBeNull();
    expect(normalizeLinkedinUrl("hello")).toBeNull();
    expect(linkedinSlug("https://www.linkedin.com/in/JaneDoe/")).toBe("janedoe");
  });
});

describe("planCompanyMatches", () => {
  const acme: ExistingCompany = { id: 1, name: "Acme", nameKey: "acme", domain: "acme.com" };
  const legacyName: ExistingCompany = { id: 2, name: "Globex", nameKey: "globex", domain: null };

  it("matches by domain first, whatever the name says", () => {
    const p = planCompanyMatches([{ name: "Totally Different Name", domain: "acme.com" }], [acme]);
    expect(p.assignments).toEqual([{ kind: "existing", id: 1 }]);
    expect(p.creates).toEqual([]);
  });

  it("falls back to the normalized name when there is no domain", () => {
    const p = planCompanyMatches([{ name: "ACME, Inc.", domain: null }], [acme]);
    expect(p.assignments).toEqual([{ kind: "existing", id: 1 }]);
  });

  it("a name-only company adopts the domain the first time it is learned", () => {
    const p = planCompanyMatches([{ name: "Globex Corp", domain: "globex.com" }], [legacyName]);
    expect(p.assignments).toEqual([{ kind: "existing", id: 2 }]);
    expect(p.adoptions).toEqual([{ id: 2, domain: "globex.com" }]);
  });

  it("NEVER merges two different domains that share a name; flags a possible duplicate instead", () => {
    const p = planCompanyMatches([{ name: "Acme", domain: "acme.io" }], [acme]);
    expect(p.assignments).toEqual([{ kind: "new", index: 0 }]);
    expect(p.creates).toEqual([{ name: "Acme", nameKey: "acme", domain: "acme.io" }]);
    expect(p.possibleDuplicates).toHaveLength(1);
    expect(p.adoptions).toEqual([]);
  });

  it("name-only input that is ambiguous between several domains creates a name-only company, not a guess", () => {
    const acmeIo: ExistingCompany = { id: 3, name: "Acme", nameKey: "acme", domain: "acme.io" };
    const p = planCompanyMatches([{ name: "Acme", domain: null }], [acme, acmeIo]);
    expect(p.assignments).toEqual([{ kind: "new", index: 0 }]);
    expect(p.creates[0].domain).toBeNull();
    expect(p.possibleDuplicates).toHaveLength(1);
  });

  it("rows in one batch that name the same new company resolve to ONE company", () => {
    const p = planCompanyMatches(
      [
        { name: "Initech", domain: null },
        { name: "Initech LLC", domain: "initech.com" }, // adopts the just-planned name-only company
        { name: null, domain: "initech.com" },
      ],
      [],
    );
    expect(p.creates).toEqual([{ name: "Initech", nameKey: "initech", domain: "initech.com" }]);
    expect(p.assignments).toEqual([{ kind: "new", index: 0 }, { kind: "new", index: 0 }, { kind: "new", index: 0 }]);
  });

  it("no name and no domain ⇒ no company", () => {
    const p = planCompanyMatches([{ name: "  ", domain: null }, { name: null, domain: "garbage" }], []);
    expect(p.assignments).toEqual([null, null]);
    expect(resolveIdentity({ name: null, domain: "acme.com" })).toMatchObject({ name: "acme.com", nameKey: "acme", hasName: false });
  });

  it("a domain-only lead does not silently claim an unrelated name-only company", () => {
    const p = planCompanyMatches([{ name: null, domain: "globex.com" }], [legacyName]);
    expect(p.adoptions).toEqual([]);
    expect(p.creates).toEqual([{ name: "globex.com", nameKey: "globex", domain: "globex.com" }]);
  });
});
