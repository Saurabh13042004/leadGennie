import { TONE } from "@/components/ui/Badge";
import type { DraftStatus } from "@/lib/domain/personalization/types";

/**
 * Draft status label + badge classes. Plain module (not "use client") so server components can read it:
 * a value imported from a client module is only a client reference on the server.
 */
export const STATUS_STYLE: Record<DraftStatus, { label: string; cls: string }> = {
  draft: { label: "Needs review", cls: `ring-1 ring-inset ${TONE.indigo.badge}` },
  edited: { label: "Edited", cls: `ring-1 ring-inset ${TONE.violet.badge}` },
  approved: { label: "Approved", cls: `ring-1 ring-inset ${TONE.emerald.badge}` },
  rejected: { label: "Rejected", cls: `ring-1 ring-inset ${TONE.neutral.badge}` },
  failed_validation: { label: "Failed checks", cls: `ring-1 ring-inset ${TONE.rose.badge}` },
};
