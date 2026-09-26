import { revalidatePath } from "next/cache";

/** Every page that shows a lead or a count of leads: deleting one must not leave a stale row or number on any of them. */
export function revalidateAfterLeadDelete(): void {
  for (const path of ["/dashboard/leads", "/dashboard/lead-lists", "/dashboard/campaigns", "/dashboard/campaigns/new", "/dashboard"]) revalidatePath(path);
  revalidatePath("/dashboard/campaigns/[id]", "page");
}
