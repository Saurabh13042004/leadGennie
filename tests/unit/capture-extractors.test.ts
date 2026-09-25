import { describe, expect, it } from "vitest";
import { classifyPage, jsonLdExtractor, mailtoExtractor, mergeProposals, selectionExtractor, siteExtractor, linkedinProfileExtractor } from "@/lib/domain/capture/extractors";
import { linkedinProfilePath, parseLinkedinTitle } from "@/lib/domain/capture/linkedin";
import { pageFactsSchema, type PageFacts } from "@/lib/domain/capture/schemas";
import { cleanSourceUrl } from "@/lib/domain/capture/service";

const facts = (over: Partial<PageFacts> & { url: string }): PageFacts => pageFactsSchema.parse({ title: "", text: "", ...over });

describe("parseLinkedinTitle", () => {
  const cases: [string, ReturnType<typeof parseLinkedinTitle>][] = [
    ["Sarah Chen - VP Sales - Acme | LinkedIn", { name: "Sarah Chen", jobTitle: "VP Sales", company: "Acme" }],
    ["(3) Sarah Chen - VP Sales - Acme Inc | LinkedIn", { name: "Sarah Chen", jobTitle: "VP Sales", company: "Acme Inc" }],
    ["Sarah Chen - Head of Growth | LinkedIn", { name: "Sarah Chen", jobTitle: "Head of Growth" }],
    ["Sarah Chen - Acme | LinkedIn", { name: "Sarah Chen", company: "Acme" }],
    ["Sarah Chen | LinkedIn", { name: "Sarah Chen" }],
    ["Sarah Chen – Founder & CEO – Acme | LinkedIn", { name: "Sarah Chen", jobTitle: "Founder & CEO", company: "Acme" }],
    ["Sarah Chen - Director - Acme - EMEA | LinkedIn", { name: "Sarah Chen", jobTitle: "Director", company: "Acme - EMEA" }],
    ["", {}],
    ["LinkedIn", {}],
  ];
  it.each(cases)("%j", (title, expected) => expect(parseLinkedinTitle(title)).toEqual(expected));

  it("extracts the profile slug only from personal profile URLs", () => {
    expect(linkedinProfilePath("https://www.linkedin.com/in/sarah-chen-123/")).toBe("sarah-chen-123");
    expect(linkedinProfilePath("https://uk.linkedin.com/in/sarah?trk=x")).toBe("sarah");
    expect(linkedinProfilePath("https://www.linkedin.com/company/acme")).toBeNull();
    expect(linkedinProfilePath("https://evil.com/in/sarah")).toBeNull();
  });
});

describe("classifyPage", () => {
  it("tells profiles, other LinkedIn pages and the open web apart", () => {
    expect(classifyPage("https://www.linkedin.com/in/sarah")).toBe("linkedin_profile");
    expect(classifyPage("https://www.linkedin.com/company/acme")).toBe("linkedin_other");
    expect(classifyPage("https://acme.com/team")).toBe("web");
    expect(classifyPage("garbage")).toBe("web");
  });
});

describe("linkedinProfileExtractor", () => {
  it("proposes name/title/company from the title and the canonical profile URL, preferring the page's own <h1>", () => {
    const f = facts({ url: "https://www.linkedin.com/in/sarah-chen/?miniProfileUrn=x", title: "Sarah Chen - VP Sales - Acme | LinkedIn", headings: ["Sarah Chen"] });
    expect(linkedinProfileExtractor.extract(f, "linkedin_profile")).toEqual({
      linkedinUrl: "https://www.linkedin.com/in/sarah-chen", fullName: "Sarah Chen", jobTitle: "VP Sales", company: "Acme",
    });
  });
  it("does nothing off LinkedIn", () => {
    expect(linkedinProfileExtractor.extract(facts({ url: "https://acme.com", title: "A - B - C" }), "web")).toEqual({});
  });
});

describe("jsonLdExtractor", () => {
  it("reads a Person with employer, email and LinkedIn from sameAs — including inside @graph", () => {
    const f = facts({
      url: "https://acme.com/team/sarah",
      jsonld: [{ "@graph": [
        { "@type": "Organization", name: "Ignored Org" },
        { "@type": "Person", name: "Sarah Chen", jobTitle: "VP Sales", email: "mailto:sarah@acme.com",
          worksFor: { "@type": "Organization", name: "Acme", url: "https://www.acme.com/about" },
          sameAs: ["https://twitter.com/sarah", "https://www.linkedin.com/in/sarah-chen"] },
      ] }],
    });
    expect(jsonLdExtractor.extract(f, "web")).toEqual({
      fullName: "Sarah Chen", jobTitle: "VP Sales", email: "sarah@acme.com", company: "Acme", companyDomain: "acme.com",
      linkedinUrl: "https://www.linkedin.com/in/sarah-chen",
    });
  });
  it("falls back to an Organization for the company when there is no Person", () => {
    const f = facts({ url: "https://acme.com", jsonld: [{ "@type": "Organization", name: "Acme", url: "https://acme.com" }] });
    expect(jsonLdExtractor.extract(f, "web")).toEqual({ company: "Acme", companyDomain: "acme.com" });
  });
  it("survives garbage", () => {
    expect(jsonLdExtractor.extract(facts({ url: "https://a.com", jsonld: [null, 5, "x", [[[[[[["deep"]]]]]]]] }), "web")).toEqual({});
  });
});

describe("selection, site and mailto extractors", () => {
  it("selection: a bare email, or a short capitalised name, is an explicit signal", () => {
    expect(selectionExtractor.extract(facts({ url: "https://a.com", selection: "sarah@acme.com" }), "web")).toEqual({ email: "sarah@acme.com" });
    expect(selectionExtractor.extract(facts({ url: "https://a.com", selection: "Sarah Chen" }), "web")).toEqual({ fullName: "Sarah Chen" });
    expect(selectionExtractor.extract(facts({ url: "https://a.com", selection: "Sarah Chen <sarah@acme.com>" }), "web")).toMatchObject({ email: "sarah@acme.com", fullName: "Sarah Chen" });
    expect(selectionExtractor.extract(facts({ url: "https://a.com", selection: "we are hiring a sales lead this quarter" }), "web")).toEqual({});
  });

  it("site: a company website proposes its domain and name; social/aggregator sites never do", () => {
    expect(siteExtractor.extract(facts({ url: "https://www.acme.com/team", siteName: "Acme" }), "web")).toEqual({ companyDomain: "acme.com", company: "Acme" });
    for (const url of ["https://github.com/sarah", "https://twitter.com/sarah", "https://docs.google.com/x", "https://www.crunchbase.com/organization/acme"]) {
      expect(siteExtractor.extract(facts({ url, siteName: "Whatever" }), "web")).toEqual({});
    }
    expect(siteExtractor.extract(facts({ url: "https://www.linkedin.com/in/x" }), "linkedin_profile")).toEqual({});
  });

  it("site: the host only counts on pages that look like the company's own — not on a blog post or article", () => {
    const domainAt = (url: string) => siteExtractor.extract(facts({ url }), "web").companyDomain;
    for (const url of ["https://acme.com", "https://acme.com/", "https://acme.com/team", "https://www.acme.com/about-us", "https://acme.com/people/sarah", "https://acme.com/contact"]) {
      expect(domainAt(url), url).toBe("acme.com");
    }
    for (const url of ["https://sarahchen.dev/blog/why-i-left", "https://acme.com/news/2026/funding", "https://acme.com/careers/engineer"]) {
      expect(domainAt(url), url).toBeUndefined();
    }
    // …unless the site names itself.
    expect(siteExtractor.extract(facts({ url: "https://acme.com/news/x", siteName: "Acme" }), "web")).toEqual({ companyDomain: "acme.com", company: "Acme" });
  });

  it("mailto: only when exactly one personal address is on the page", () => {
    const one = facts({ url: "https://a.com", emails: ["Sarah@Acme.com", "info@acme.com", "sarah@acme.com"] });
    expect(mailtoExtractor.extract(one, "web")).toEqual({ email: "sarah@acme.com" });
    expect(mailtoExtractor.extract(facts({ url: "https://a.com", emails: ["a@acme.com", "b@acme.com"] }), "web")).toEqual({});
    expect(mailtoExtractor.extract(facts({ url: "https://a.com", emails: ["noreply@acme.com", "x@mailinator.com"] }), "web")).toEqual({});
  });
});

describe("mergeProposals", () => {
  it("first extractor wins per field, and the source is recorded", () => {
    const f = facts({
      url: "https://acme.com/team", siteName: "Acme Site", selection: "Sarah Chen", emails: ["sarah@acme.com"],
      jsonld: [{ "@type": "Person", name: "JSON Name", jobTitle: "VP Sales" }],
    });
    const { fields, sources } = mergeProposals(f, "web");
    expect(fields).toMatchObject({ fullName: "Sarah Chen", jobTitle: "VP Sales", company: "Acme Site", companyDomain: "acme.com", email: "sarah@acme.com" });
    expect(sources).toMatchObject({ fullName: "selection", jobTitle: "jsonld", company: "site", companyDomain: "site", email: "mailto" });
  });
});

describe("cleanSourceUrl", () => {
  it("drops query strings and fragments (tracking ids, tokens) before anything is stored", () => {
    expect(cleanSourceUrl("https://www.linkedin.com/in/sarah?miniProfileUrn=abc&trk=x#top")).toBe("https://www.linkedin.com/in/sarah");
    expect(cleanSourceUrl("not a url")).toBe("not a url");
  });
});
