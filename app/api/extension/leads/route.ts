import { NextResponse } from "next/server";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { insertLead } from "@/lib/db/leads-core";
import { extractLeadInfoFromPage } from "@/lib/ai/linkedin-personalize";
import { GeminiError } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { pageText, linkedin_url } = body as { pageText?: string; linkedin_url?: string };

  if (!pageText || !pageText.trim()) {
    return NextResponse.json({ error: "pageText is required" }, { status: 400 });
  }

  try {
    const extracted = await extractLeadInfoFromPage(pageText);
    const lead = await insertLead(
      auth.workspaceId,
      auth.ownerEmail,
      {
        full_name: extracted.full_name,
        job_title: extracted.job_title,
        company: extracted.company,
        linkedin_url,
      },
      "linkedin_extension"
    );
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create lead" },
      { status: 400 }
    );
  }
}
