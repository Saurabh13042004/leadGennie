/**
 * Mailbox vocabulary shared by the repository, services, actions and UI. Plain types and pure rules only — no I/O — so a
 * client component may import this file.
 */

export const MAILBOX_PROVIDERS = ["gmail", "microsoft", "resend"] as const;
export type MailboxProviderKey = (typeof MAILBOX_PROVIDERS)[number];
/** The providers a user connects by signing in (as opposed to Resend, which is a verified sending domain). */
export type OAuthMailboxProvider = Extract<MailboxProviderKey, "gmail" | "microsoft">;

export const isOAuthProvider = (p: string): p is OAuthMailboxProvider => p === "gmail" || p === "microsoft";
export const isMailboxProvider = (p: string): p is MailboxProviderKey => (MAILBOX_PROVIDERS as readonly string[]).includes(p);

/**
 * `active` is the stored value for "connected and allowed to send" — it predates OAuth and every send path already checks it,
 * so it stays; the UI labels it "Connected". The rest are new, and only OAuth mailboxes ever reach them.
 */
export const MAILBOX_STATUSES = ["pending_approval", "active", "paused", "reconnect_required", "disconnected", "error"] as const;
export type MailboxStatus = (typeof MAILBOX_STATUSES)[number];

export const PROVIDER_LABEL: Record<MailboxProviderKey, string> = {
  gmail: "Google",
  microsoft: "Microsoft",
  resend: "Resend domain",
};

/** The mailbox as the UI and services see it. Credentials are deliberately NOT part of this type. */
export type Mailbox = {
  id: number;
  email: string;
  displayName: string | null;
  provider: MailboxProviderKey;
  status: MailboxStatus;
  dailyLimit: number;
  /** Counted from `messages` (the same rows the send gate counts), per mailbox, since 00:00 UTC. */
  sentToday: number;
  domainId: number | null;
  domainName: string | null;
  domainStatus: string | null;
  approvalId: number | null;
  ownerUserId: number | null;
  lastError: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  /** Running or paused-by-system campaigns that send through this mailbox (what disconnecting would stop). */
  activeCampaigns: number;
  /** Whether it can be picked for a campaign right now, and if not, why — in words a user can act on. */
  sendable: boolean;
  blockedReason: string | null;
};

type Sendability = { provider: string; status: string; domainStatus?: string | null };

/**
 * Why a mailbox can't send right now, or null if it can. One rule for the campaign picker, readiness check, launch and the send
 * handler — so the UI, the API and the worker can never disagree. The Resend wording predates OAuth and is asserted in tests.
 */
export function mailboxBlockedReason(m: Sendability): string | null {
  switch (m.status) {
    case "active":
      return m.provider === "resend" && m.domainStatus !== "verified" ? "The sending domain isn't verified." : null;
    case "pending_approval":
      return "It's waiting for an owner or admin to approve it.";
    case "paused":
      return "It's paused. Resume it to send.";
    case "reconnect_required":
      return "Your mailbox needs to be reconnected before LeadGennie can continue sending.";
    case "disconnected":
      return "It's disconnected. Reconnect it to send.";
    case "error":
      return "It ran into an error. Check it under Settings → Mailboxes.";
    default:
      return "It isn't available for sending.";
  }
}

export const isSendable = (m: Sendability) => mailboxBlockedReason(m) === null;

/** Transitions (pure) — enforced by `assertMailboxTransition`. */
export const MAILBOX_TRANSITIONS: Record<MailboxStatus, readonly MailboxStatus[]> = {
  pending_approval: ["active"], // approval rejected ⇒ the row is deleted, not moved
  active: ["paused", "reconnect_required", "disconnected", "error"],
  paused: ["active", "reconnect_required", "disconnected"],
  reconnect_required: ["active", "disconnected"],
  error: ["active", "paused", "reconnect_required", "disconnected"],
  // Connecting again through OAuth is the only way back from a disconnect.
  disconnected: ["active"],
};

export const canTransitionMailbox = (from: MailboxStatus, to: MailboxStatus) => MAILBOX_TRANSITIONS[from].includes(to);
