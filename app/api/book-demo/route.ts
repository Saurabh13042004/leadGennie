import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name,
    email,
    company,
    companySize,
    outboundVolume,
    challenges,
    crmUsed,
  } = body as {
    name?: string;
    email?: string;
    company?: string;
    companySize?: string;
    outboundVolume?: string;
    challenges?: string[];
    crmUsed?: string;
  };

  if (!name || !email || !company) {
    return NextResponse.json(
      { error: "Name, email, and company are required." },
      { status: 400 }
    );
  }

  await sql`
    insert into demo_requests
      (name, email, company, company_size, outbound_volume, challenges, crm_used)
    values
      (${name}, ${email}, ${company}, ${companySize ?? null}, ${outboundVolume ?? null}, ${challenges ?? []}, ${crmUsed ?? null})
  `;

  return NextResponse.json({ ok: true });
}
