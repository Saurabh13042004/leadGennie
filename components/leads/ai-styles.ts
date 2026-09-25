/**
 * The violet→fuchsia treatment reserved for AI / Gennie moments (research, generate, AI filters).
 * Layer it over `buttonClasses({ variant: "primary" })` so size, focus and disabled states stay shared.
 */
export const AI_BUTTON =
  "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_1px_2px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-violet-500 hover:to-fuchsia-500";

/** Small gradient tile behind an AI icon. */
export const AI_TILE =
  "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_8px_-2px_rgba(124,58,237,0.55)]";
