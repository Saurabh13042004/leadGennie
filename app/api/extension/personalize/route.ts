import { NextResponse } from "next/server";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { generatePersonalizedLinkedinMessage } from "@/lib/ai/linkedin-personalize";
import { GeminiError } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { profileUrl, pageText, sdrContext, customPrompt } = body as {
    profileUrl?: string;
    pageText?: string;
    sdrContext?: string;
    customPrompt?: string;
  };

  if (!profileUrl) {
    return NextResponse.json({ error: "profileUrl is required" }, { status: 400 });
  }
  if (!pageText || !pageText.trim()) {
    return NextResponse.json({ error: "pageText is required" }, { status: 400 });
  }

  try {
    const result = await generatePersonalizedLinkedinMessage(profileUrl, pageText, sdrContext, customPrompt);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }
}
