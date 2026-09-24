import { normalizeCompanyName, normalizeDomain, nameKeyFromDomain } from "./normalize";

/**
 * Pure company-matching planner. Given the identities to resolve and the
 * candidate companies already in ONE workspace, decide — without I/O — which
 * existing company each identity maps to, which need creating, and which
 * name-only companies should adopt a newly learned domain.
 *
 * Rules (docs/phases/phase-01, "Risks"):
 *  1. A domain match wins.
 *  2. Otherwise a name match — but two *different* domains are never merged
 *     because their names collide; that is surfaced as a possible duplicate.
 *  3. A name-only company adopts the domain the first time we learn it.
 *  4. Free-mail/disposable email domains never reach here (validate.ts drops them).
 * The repository loads candidates for a single workspace, so a match can never cross workspaces.
 */

export type CompanyIdentity = { name: string | null; domain: string | null };

export type ResolvedIdentity = {
  /** Display name for a new company (falls back to the domain when the name is unknown). */
  name: string;
  /** Matching key. "" is impossible: identities without a usable key resolve to null. */
  nameKey: string;
  domain: string | null;
  /** True when the display name came from the caller, not from the domain. */
  hasName: boolean;
};

export type ExistingCompany = { id: number; name: string; nameKey: string; domain: string | null };

export type Assignment = { kind: "existing"; id: number } | { kind: "new"; index: number };

export type PlannedCompany = { name: string; nameKey: string; domain: string | null };

export type CompanyPlan = {
  /** Same length/order as the input; null when the identity carries no company at all. */
  assignments: (Assignment | null)[];
  creates: PlannedCompany[];
  adoptions: { id: number; domain: string }[];
  /** Input indexes that collided by name with a company on a *different* domain (created separately, not merged). */
  possibleDuplicates: { inputIndex: number; existingKey: string }[];
};

export function resolveIdentity(input: CompanyIdentity): ResolvedIdentity | null {
  const domain = normalizeDomain(input.domain);
  const name = (input.name ?? "").replace(/\s+/g, " ").trim();
  const nameKey = normalizeCompanyName(name);
  if (nameKey) return { name, nameKey, domain, hasName: true };
  if (domain) return { name: domain, nameKey: nameKeyFromDomain(domain), domain, hasName: false };
  return null;
}

type Entry = { assignment: Assignment; nameKey: string; domain: string | null; created: PlannedCompany | null };

export function planCompanyMatches(inputs: CompanyIdentity[], existing: ExistingCompany[]): CompanyPlan {
  const byDomain = new Map<string, Entry>();
  const byNameKey = new Map<string, Entry[]>();
  const index = (e: Entry) => {
    if (e.domain) byDomain.set(e.domain, e);
    const list = byNameKey.get(e.nameKey) ?? [];
    if (!list.includes(e)) list.push(e);
    byNameKey.set(e.nameKey, list);
  };
  for (const c of existing) {
    index({ assignment: { kind: "existing", id: c.id }, nameKey: c.nameKey, domain: c.domain ? c.domain.toLowerCase() : null, created: null });
  }

  const plan: CompanyPlan = { assignments: [], creates: [], adoptions: [], possibleDuplicates: [] };

  const create = (id: ResolvedIdentity, inputIndex: number, collidedWith: Entry[]) => {
    const planned: PlannedCompany = { name: id.name, nameKey: id.nameKey, domain: id.domain };
    plan.creates.push(planned);
    const entry: Entry = { assignment: { kind: "new", index: plan.creates.length - 1 }, nameKey: id.nameKey, domain: id.domain, created: planned };
    index(entry);
    if (collidedWith.length > 0) plan.possibleDuplicates.push({ inputIndex, existingKey: id.nameKey });
    return entry;
  };

  const adopt = (entry: Entry, domain: string) => {
    entry.domain = domain;
    if (entry.created) entry.created.domain = domain;
    else if (entry.assignment.kind === "existing") plan.adoptions.push({ id: entry.assignment.id, domain });
    byDomain.set(domain, entry);
  };

  inputs.forEach((raw, i) => {
    const id = resolveIdentity(raw);
    if (!id) {
      plan.assignments.push(null);
      return;
    }
    const sameName = byNameKey.get(id.nameKey) ?? [];

    let entry: Entry | undefined;
    if (id.domain) {
      entry = byDomain.get(id.domain);
      if (!entry) {
        // Only adopt into a name-only company, and only when we were given a real name to compare
        // (a domain-derived key like "acme" must not silently claim an unrelated "Acme").
        const nameOnly = id.hasName ? sameName.find((c) => c.domain === null) : undefined;
        if (nameOnly) {
          adopt(nameOnly, id.domain);
          entry = nameOnly;
        } else {
          entry = create(id, i, sameName);
        }
      }
    } else {
      const nameOnly = sameName.find((c) => c.domain === null);
      if (nameOnly) entry = nameOnly;
      else if (sameName.length === 1) entry = sameName[0];
      else entry = create(id, i, sameName); // none, or ambiguous between several domains
    }
    plan.assignments.push(entry.assignment);
  });

  return plan;
}
