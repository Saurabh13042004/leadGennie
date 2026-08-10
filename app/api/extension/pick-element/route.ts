import { NextResponse } from "next/server";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { pickLinkedInElement, type ClickableCandidate } from "@/lib/ai/linkedin-element-picker";
import { GeminiError } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 60;

export async function POST(request: Request) {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { candidates, taskDescription } = body as {
    candidates?: ClickableCandidate[];
    taskDescription?: string;
  };

  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "candidates is required" }, { status: 400 });
  }
  if (!taskDescription || !taskDescription.trim()) {
    return NextResponse.json({ error: "taskDescription is required" }, { status: 400 });
  }

  try {
    const result = await pickLinkedInElement(candidates.slice(0, MAX_CANDIDATES), taskDescription);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }
}
