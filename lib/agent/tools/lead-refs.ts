import { z } from "zod";
import { MAX_LEADS_PER_RUN } from "@/lib/agent/types";

export const fromSchema = z.string().regex(/^s[1-9]$/);

const leadIdsSchema = z.array(z.number().int().positive()).max(MAX_LEADS_PER_RUN);

/** Reads the lead list a dependency produced. Steps never carry literal lead ids of their own. */
export function leadIdsFrom(deps: Record<string, Record<string, unknown>>, from: string): number[] | null {
  const parsed = leadIdsSchema.safeParse(deps[from]?.leadIds);
  return parsed.success ? parsed.data : null;
}
