import { esc, button, paragraph, renderLayout, type EmailContent } from "./layout";

export type InviteRole = "admin" | "member" | "viewer";

const ROLE_BLURB: Record<InviteRole, string> = {
  admin: "manage members and approve campaigns, as well as everything a member can do",
  member: "work on leads, research and campaigns",
  viewer: "view leads, campaigns and results (read-only)",
};

/**
 * `existingAccount` decides where the button goes: someone who already has a LeadGennie login was added straight away and
 * just needs to sign in; a new person creates an account with this same address, which is what links them to the workspace.
 */
export function inviteEmail(input: { inviterName: string; workspaceName: string; role: InviteRole; inviteeEmail: string; existingAccount: boolean; baseUrl: string }): EmailContent {
  const url = input.existingAccount ? `${input.baseUrl}/login` : `${input.baseUrl}/signup?email=${encodeURIComponent(input.inviteeEmail)}`;
  const action = input.existingAccount ? "Open LeadGennie" : "Accept invitation";
  const who = input.inviterName.trim() || "A teammate";
  const heading = `Join ${input.workspaceName} on LeadGennie`;
  const body =
    paragraph(`<strong style="color:#171717;">${esc(who)}</strong> invited you to the <strong style="color:#171717;">${esc(input.workspaceName)}</strong> workspace as ${esc(input.role === "admin" ? "an" : "a")} <strong style="color:#171717;">${esc(input.role)}</strong>. You'll be able to ${esc(ROLE_BLURB[input.role])}.`) +
    paragraph(
      input.existingAccount
        ? "You already have a LeadGennie account, so you've been added — sign in and switch to the workspace."
        : `Create your account with <strong style="color:#171717;">${esc(input.inviteeEmail)}</strong> — the address this invitation was sent to — and you'll land straight in the workspace.`,
    ) +
    button(action, url) +
    `<p style="margin:0 0 20px;font-size:12px;line-height:18px;color:#737373;">Button not working? Paste this link into your browser:<br><a href="${esc(url)}" style="color:#525252;word-break:break-all;">${esc(url)}</a></p>`;
  return {
    subject: `${who} invited you to ${input.workspaceName} on LeadGennie`,
    html: renderLayout({
      preheader: `${who} invited you to join ${input.workspaceName}.`,
      heading,
      body,
      footer: "If you weren't expecting this invitation you can ignore this email — nothing happens unless you accept.",
    }),
    text: [
      `${who} invited you to the ${input.workspaceName} workspace on LeadGennie as ${input.role === "admin" ? "an" : "a"} ${input.role}.`,
      `You'll be able to ${ROLE_BLURB[input.role]}.`,
      "",
      input.existingAccount ? "You already have an account — sign in to get started:" : `Create your account with ${input.inviteeEmail} to join:`,
      url,
      "",
      "If you weren't expecting this invitation you can ignore this email.",
    ].join("\n"),
  };
}
