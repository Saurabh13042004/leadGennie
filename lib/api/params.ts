import { AppError } from "./errors";

/** Positive integer route/query id, or a 400 — never a NaN reaching SQL. */
export function parseId(raw: string | null | undefined, what = "id"): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new AppError("BAD_REQUEST", `Invalid ${what}.`);
  return n;
}
