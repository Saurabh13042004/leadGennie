import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api";
import { sql } from "@/lib/db/client";

const Body = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address.").max(254),
  company: z.string().trim().min(1, "Company is required.").max(160),
  companySize: z.string().trim().max(60).optional(),
  outboundVolume: z.string().trim().max(60).optional(),
  challenges: z.array(z.string().trim().max(120)).max(20).optional(),
  crmUsed: z.string().trim().max(120).optional(),
});

export const POST = withApi(async (request) => {
  const { name, email, company, companySize, outboundVolume, challenges, crmUsed } = await parseJson(request, Body);

  await sql`
    insert into demo_requests
      (name, email, company, company_size, outbound_volume, challenges, crm_used)
    values
      (${name}, ${email}, ${company}, ${companySize ?? null}, ${outboundVolume ?? null}, ${challenges ?? []}, ${crmUsed ?? null})
  `;

  return ok();
});
