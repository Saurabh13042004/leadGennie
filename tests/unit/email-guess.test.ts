import { describe, expect, it } from "vitest";
import { guessDomains, guessEmails, inferPatterns, namePartsForEmail } from "@/lib/domain/capture/email-guess";
import { extractLinkedinText, parseHeadline } from "@/lib/domain/capture/linkedin-text";
import { grounded } from "@/lib/domain/capture/service";

describe("guessEmails — common company formats", () => {
  it("offers the usual formats for first + last, most common first", () => {
    const g = guessEmails({ fullName: "Sarah Chen", domain: "acme.com" });
    expect(g.map((x) => x.email)).toEqual([
      "sarah.chen@acme.com", "sarah@acme.com", "schen@acme.com", "sarahchen@acme.com", "s.chen@acme.com", "sarah_chen@acme.com",
    ]);
    expect(g.every((x) => x.basis === "common")).toBe(true);
  });

  it("with only a first name, offers only the first-name format", () => {
    expect(guessEmails({ fullName: "Cher", domain: "acme.com" }).map((x) => x.email)).toEqual(["cher@acme.com"]);
  });

  it("returns nothing without a usable name or domain", () => {
    expect(guessEmails({ fullName: "", domain: "acme.com" })).toEqual([]);
    expect(guessEmails({ fullName: "Sarah Chen", domain: "" })).toEqual([]);
  });

  it("normalises accents, punctuation and titles into clean ASCII local parts", () => {
    const e = (name: string) => guessEmails({ fullName: name, domain: "x.com", limit: 1 })[0].email;
    expect(e("José Álvarez")).toBe("jose.alvarez@x.com");
    expect(e("Dr. Anne-Marie O'Brien Jr.")).toBe("annemarie.obrien@x.com"); // hyphen and apostrophe dropped, title/suffix ignored
    expect(e("Mary Jane Watson")).toBe("mary.watson@x.com");
    expect(e("Ludwig van Beethoven")).toBe("ludwig.vanbeethoven@x.com");
    expect(namePartsForEmail("Łukasz Nowak")).toEqual({ first: "lukasz", last: "nowak" });
    expect(e("Søren Größe")).toBe("soren.grosse@x.com");
  });

  it("de-duplicates formats that collapse to the same address", () => {
    const g = guessEmails({ fullName: "Li Wu", domain: "x.com", limit: 10 }).map((x) => x.email);
    expect(new Set(g).size).toBe(g.length);
  });

  it("ranks the format your OWN emails at that domain use first, and says how many match", () => {
    const known = [
      { fullName: "Alex Rivera", email: "arivera@acme.com" },
      { fullName: "Maria Gomez", firstName: "Maria", lastName: "Gomez", email: "mgomez@acme.com" },
      { fullName: "Pat Lee", email: "pat.lee@acme.com" },
    ];
    expect(Object.fromEntries(inferPatterns(known))).toEqual({ flast: 2, "first.last": 1 });
    const g = guessEmails({ fullName: "Sarah Chen", domain: "acme.com", known });
    expect(g[0]).toEqual({ email: "schen@acme.com", pattern: "flast", basis: "existing", matches: 2 });
    expect(g[1]).toMatchObject({ email: "sarah.chen@acme.com", basis: "existing", matches: 1 });
    expect(g[2].basis).toBe("common");
  });

  it("ignores +tags and emails that don't match any format", () => {
    expect(inferPatterns([{ fullName: "Sam Ng", email: "sam.ng+news@acme.com" }, { fullName: "Bo Li", email: "xyz123@acme.com" }]).get("first.last")).toBe(1);
  });
});

describe("guessDomains", () => {
  it("guesses from the company name, ignoring legal suffixes; nothing for names too short/long", () => {
    expect(guessDomains("Acme Inc.")).toEqual(["acme.com", "acme.io", "acme.ai", "acme.co"]);
    expect(guessDomains("The Acme Company")).toEqual(["acme.com", "acme.io", "acme.ai", "acme.co"]);
    expect(guessDomains("AB")).toEqual([]);
    expect(guessDomains(null)).toEqual([]);
    expect(guessDomains("x".repeat(60))).toEqual([]);
  });
});

describe("parseHeadline", () => {
  const cases: [string, ReturnType<typeof parseHeadline>][] = [
    ["VP Sales at Acme | Ex-Initech", { title: "VP Sales", company: "Acme" }],
    ["Founder & CEO @ Globex", { title: "Founder & CEO", company: "Globex" }],
    ["Head of Data at Scale AI · Formerly Google", { title: "Head of Data", company: "Scale AI" }],
    ["Engineering Manager at Acme Inc., Berlin", { title: "Engineering Manager", company: "Acme Inc." }],
    ["Helping SaaS teams grow", {}],
  ];
  it.each(cases)("%s", (h, expected) => expect(parseHeadline(h)).toEqual(expected));
});

describe("extractLinkedinText — real-shaped profile text", () => {
  const profile = `Skip to main content
Sarah Chen
She/Her
· 2nd
VP Sales at Acme | Ex-Initech
New York, New York, United States · Contact info
500+ connections
Acme
Columbia University
Message
More
About
I lead outbound sales.
Experience
VP Sales
Acme · Full-time
Jan 2022 - Present · 3 yrs 8 mos
Account Executive
Initech · Full-time`;

  it("reads title and company from the headline", () => {
    expect(extractLinkedinText(profile, "Sarah Chen", [])).toEqual({ jobTitle: "VP Sales", company: "Acme" });
  });

  it("prefers the top card's 'Current company' label over the headline", () => {
    const r = extractLinkedinText(profile.replace("VP Sales at Acme | Ex-Initech", "Growth leader at heart"), "Sarah Chen", ["Current company: Acme Corporation. Click to skip to experience card"]);
    expect(r.company).toBe("Acme Corporation");
  });

  it("falls back to the first Experience entry when the headline has no company", () => {
    const text = profile.replace("VP Sales at Acme | Ex-Initech", "Sales leader | Coach | Speaker");
    expect(extractLinkedinText(text, "Sarah Chen", [])).toEqual({ company: "Acme", jobTitle: "VP Sales" });
  });

  it("finds nothing (rather than guessing) when the page has neither", () => {
    expect(extractLinkedinText("Casey Jones\nBerlin, Germany\nMessage", "Casey Jones", [])).toEqual({});
    expect(extractLinkedinText("", undefined, [])).toEqual({});
  });

  it("skips noise lines (pronouns, degree, connection counts) when looking for the headline", () => {
    const r = extractLinkedinText("Sam Ng\nHe/Him\n· 1st\n1,204 followers\nCTO at Globex\nLondon", "Sam Ng", []);
    expect(r).toEqual({ jobTitle: "CTO", company: "Globex" });
  });
});

describe("grounded — forgiving about format, strict about content", () => {
  const page = "Sarah Chen VP Sales at Acme, Inc. — New York · Café Münch GmbH partner";
  it("accepts cosmetic differences", () => {
    expect(grounded("Acme Inc", page, "company")).toBe(true); // page says "Acme, Inc."
    expect(grounded("acme", page, "company")).toBe(true);
    expect(grounded("Sarah  Chen", page)).toBe(true);
    expect(grounded("Cafe Munch GmbH", page, "company")).toBe(true); // accents
    expect(grounded("VP Sales", page, "jobTitle")).toBe(true);
  });
  it("still rejects anything the page doesn't say", () => {
    expect(grounded("Globex", page, "company")).toBe(false);
    expect(grounded("Grace Hopper", page)).toBe(false);
    expect(grounded("Acmeco", page, "company")).toBe(false); // not a whole-word match
    expect(grounded("A", page)).toBe(false);
  });
});

describe("extractLinkedinText — never mistakes About prose for the headline", () => {
  it("ignores 'X at Y' sentences below the top card", () => {
    const text = "Casey Jones\n· 2nd\nMaking software\nBerlin, Germany · Contact info\nAbout\nI am a Staff Engineer at Acme, Inc. and I love my job.";
    expect(extractLinkedinText(text, "Casey Jones", [])).toEqual({});
  });
  it("rejects a 'title' that is really a sentence", () => {
    const text = "Casey Jones\nI have spent the last ten years working as a senior engineer at Acme\nBerlin";
    expect(extractLinkedinText(text, "Casey Jones", []).jobTitle).toBeUndefined();
  });
});
