import { Resend } from "resend";

let client: Resend | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendCampaignEmail(input: { to: string; subject: string; body: string }) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL is not set");

  const result = await getClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}
