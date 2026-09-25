import { Resend } from "resend";

let client: Resend | null = null;

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!client) client = new Resend(apiKey);
  return client;
}
