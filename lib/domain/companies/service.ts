import * as repo from "@/lib/db/companies";
import {
  planCompanyMatches,
  resolveIdentity,
  type CompanyIdentity,
  type ExistingCompany,
  type PlannedCompany,
} from "./matcher";

/** Tenant context every domain service receives (never read from ambient state). */
export type TenantCtx = { workspaceId: number };

/** The slice of persistence the matcher needs — a role interface so tests/fakes can substitute it. */
export interface CompanyRepository {
  findCandidates(workspaceId: number, domains: string[], nameKeys: string[]): Promise<ExistingCompany[]>;
  insert(workspaceId: number, companies: PlannedCompany[], source: string): Promise<void>;
  adoptDomains(workspaceId: number, adoptions: { id: number; domain: string }[]): Promise<void>;
}

export const sqlCompanyRepository: CompanyRepository = {
  findCandidates: repo.findCompanyCandidates,
  insert: repo.insertCompanies,
  adoptDomains: repo.adoptDomains,
};

export type CompanyResolution = {
  /** Same length/order as the inputs; null = the identity had no company information. */
  companyIds: (number | null)[];
  created: number;
  adopted: number;
  /** New companies that share a name with one on a different domain (kept separate; review later). */
  possibleDuplicates: number;
};

export type CompanySource = "import" | "manual" | "extension" | "backfill";

export function createCompanyService(repository: CompanyRepository = sqlCompanyRepository) {
  /**
   * Batch resolve: a fixed number of queries regardless of input size, which is
   * what keeps a 200-row import chunk from making 200 round trips over HTTP.
   */
  async function resolveCompanies(
    ctx: TenantCtx,
    inputs: CompanyIdentity[],
    source: CompanySource = "import",
  ): Promise<CompanyResolution> {
    const identities = inputs.map(resolveIdentity);
    const domains = Array.from(new Set(identities.flatMap((i) => (i?.domain ? [i.domain] : []))));
    const nameKeys = Array.from(new Set(identities.flatMap((i) => (i ? [i.nameKey] : []))));
    if (domains.length === 0 && nameKeys.length === 0) {
      return { companyIds: inputs.map(() => null), created: 0, adopted: 0, possibleDuplicates: 0 };
    }

    const existing = await repository.findCandidates(ctx.workspaceId, domains, nameKeys);
    const plan = planCompanyMatches(inputs, existing);

    await repository.adoptDomains(ctx.workspaceId, plan.adoptions);
    await repository.insert(ctx.workspaceId, plan.creates, source);

    // Re-read so ids come from the database (also correct if a concurrent import created the same company first).
    let createdIds: (number | undefined)[] = [];
    if (plan.creates.length > 0) {
      const after = await repository.findCandidates(
        ctx.workspaceId,
        plan.creates.flatMap((c) => (c.domain ? [c.domain] : [])),
        plan.creates.map((c) => c.nameKey),
      );
      createdIds = plan.creates.map((c) =>
        c.domain
          ? after.find((a) => a.domain === c.domain)?.id
          : after.find((a) => a.domain === null && a.nameKey === c.nameKey)?.id,
      );
    }

    const companyIds = plan.assignments.map((a) => {
      if (!a) return null;
      if (a.kind === "existing") return a.id;
      const id = createdIds[a.index];
      if (id === undefined) throw new Error("Company was planned but could not be read back");
      return id;
    });

    return {
      companyIds,
      created: plan.creates.length,
      adopted: plan.adoptions.length,
      possibleDuplicates: plan.possibleDuplicates.length,
    };
  }

  /** Spec interface: `matchOrCreateCompany(ctx, {name, domain})`. */
  async function matchOrCreateCompany(
    ctx: TenantCtx,
    input: CompanyIdentity,
    source: CompanySource = "manual",
  ): Promise<{ id: number; created: boolean } | null> {
    const result = await resolveCompanies(ctx, [input], source);
    const id = result.companyIds[0];
    return id === null ? null : { id, created: result.created > 0 };
  }

  return { resolveCompanies, matchOrCreateCompany };
}

export const companyService = createCompanyService();
export const resolveCompanies = companyService.resolveCompanies;
export const matchOrCreateCompany = companyService.matchOrCreateCompany;
