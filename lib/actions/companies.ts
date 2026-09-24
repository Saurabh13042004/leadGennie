"use server";

import { requireRole } from "@/lib/auth/workspace-context";
import { searchCompanies as searchCompaniesDb, type CompanySummary } from "@/lib/db/companies";

/** Company autocomplete for the lead form (workspace-scoped, max 8 suggestions). */
export async function searchCompanies(query: string): Promise<CompanySummary[]> {
  const { workspaceId } = await requireRole("viewer");
  return searchCompaniesDb(workspaceId, String(query ?? "").slice(0, 100), 8);
}
