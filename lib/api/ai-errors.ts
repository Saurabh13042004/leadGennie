import { GeminiError } from "@/lib/ai/gemini";
import { AppError } from "./errors";

/**
 * Maps provider failures onto stable error codes so clients (and the
 * extension) can tell "quota exhausted — wait/upgrade" from "misconfigured"
 * from "provider broke". Non-AI errors pass through untouched.
 */
export function mapAiError(err: unknown): unknown {
  if (!(err instanceof GeminiError)) return err;
  const msg = err.message;
  if (/quota exceeded/i.test(msg)) return new AppError("QUOTA_EXCEEDED", msg);
  if (/not set/i.test(msg)) return new AppError("NOT_CONFIGURED", msg);
  return new AppError("PROVIDER_ERROR", msg);
}
