import { NextResponse } from "next/server";
import { processEmailSends, processLinkedinSends } from "@/lib/campaigns/dispatch";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const emailResult = await processEmailSends();
  const linkedinResult = await processLinkedinSends();

  return NextResponse.json({ email: emailResult, linkedin: linkedinResult });
}
