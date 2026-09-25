import { z } from "zod";
import { AppError, ok, parseJson, withApi } from "@/lib/api";
import { createUser, findUserByEmail } from "@/lib/users";
import { appBaseUrl } from "@/lib/campaigns/render";
import { sendSystemEmail } from "@/lib/email/system-mail";
import { welcomeEmail } from "@/lib/email/templates/welcome";

const Body = z.object({
  name: z.string({ error: "Name is required." }).trim().min(1, "Name is required.").max(120),
  email: z.string({ error: "Email is required." }).trim().min(1, "Email is required.").email("Enter a valid email address.").max(254),
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    // bcrypt only uses the first 72 bytes; refuse rather than silently truncate.
    .max(72, "Password must be at most 72 characters."),
  company: z.string().trim().max(160).optional(),
});

export const POST = withApi(async (request) => {
  const { name, email, password, company } = await parseJson(request, Body);

  if (await findUserByEmail(email)) {
    throw new AppError("CONFLICT", "An account with this email already exists.");
  }

  const user = await createUser({ name, email, password, company: company || undefined });
  // Best effort: a failed welcome email never fails sign-up (sendSystemEmail does not throw).
  await sendSystemEmail({ to: user.email, kind: "welcome", ...welcomeEmail({ name: user.name, baseUrl: appBaseUrl() }) });
  return ok({ id: user.id, email: user.email });
});
