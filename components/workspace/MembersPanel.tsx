"use client";

import { useState, useTransition } from "react";
import { CaretDown, Trash, UserPlus } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { inviteMember, removeMember, updateMemberRole, type Member } from "@/lib/actions/workspace";
import type { Role } from "@/lib/workspace";
import Card, { CardHeader, Section } from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input, Label, Select, inputClasses } from "@/components/ui/Field";
import { Callout, IconButton, Spinner, TD, TH, THEAD_ROW, shortDate } from "@/components/settings/bits";

const ROLES: Role[] = ["owner", "admin", "member", "viewer"];
const INVITABLE_ROLES: Role[] = ["admin", "member", "viewer"];

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_TONE: Record<Role, Tone> = { owner: "violet", admin: "indigo", member: "neutral", viewer: "neutral" };

export default function MembersPanel({
  initialMembers,
  currentUserId,
  canManage,
}: {
  initialMembers: Member[];
  currentUserId: number;
  canManage: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [inviting, startInvite] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startInvite(async () => {
      try {
        const { emailed } = await inviteMember(email, role);
        setNotice(
          emailed
            ? { tone: "success", text: `Invitation emailed to ${email.trim().toLowerCase()}.` }
            : { tone: "warning", text: "The invite is saved, but the email couldn't be sent (email isn't configured or the provider rejected it). Ask them to sign up with this address." },
        );
        setEmail("");
        setMembers((prev) => [
          ...prev,
          {
            id: -Date.now(),
            userId: null,
            name: null,
            email: email.trim().toLowerCase(),
            role,
            status: "invited",
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send invite");
      }
    });
  }

  async function handleRoleChange(member: Member, newRole: Role) {
    setBusyId(member.id);
    setError(null);
    try {
      await updateMemberRole(member.id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(member: Member) {
    setBusyId(member.id);
    setError(null);
    try {
      await removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setBusyId(null);
    }
  }

  const invitedCount = members.filter((m) => m.status === "invited").length;

  return (
    <div className="space-y-5">
      {canManage && (
        <Section title="Invite a teammate" description="Add someone by email and choose what they can do.">
          <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
            </div>
            <div className="sm:w-32">
              <Label htmlFor="invite-role">Role</Label>
              <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="primary" size="md" disabled={inviting}>
              {inviting ? <Spinner /> : <UserPlus className="h-4 w-4" weight="bold" />}
              Invite
            </Button>
          </form>
        </Section>
      )}

      {error && <Callout>{error}</Callout>}
      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}

      <Card className="overflow-hidden">
        <CardHeader
          title="Members"
          description={`${members.length} ${members.length === 1 ? "person" : "people"}${invitedCount ? ` · ${invitedCount} pending invite${invitedCount === 1 ? "" : "s"}` : ""}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Member</th>
                <th className={cn(TH, "w-36")}>Role</th>
                <th className={cn(TH, "hidden w-28 sm:table-cell")}>Status</th>
                <th className={cn(TH, "hidden w-32 sm:table-cell")}>Added</th>
                {canManage && <th className={cn(TH, "w-12")}><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {members.map((m) => {
                const isSelf = m.userId !== null && Number(m.userId) === currentUserId; // the driver returns bigint ids as strings
                const isBusy = busyId === m.id;
                const invited = m.status !== "active";
                return (
                  <tr key={m.id} className="group transition-colors hover:bg-neutral-50/70">
                    <td className={TD}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        {invited ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400">
                            <UserPlus className="h-3.5 w-3.5" weight="duotone" />
                          </span>
                        ) : (
                          <Avatar name={m.name ?? m.email} size="md" />
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-neutral-900">
                            <span className="truncate">{m.name ?? m.email}</span>
                            {isSelf && <Badge tone="indigo">You</Badge>}
                            {invited && <Badge tone="amber" className="sm:hidden">Invited</Badge>}
                          </p>
                          {m.name && <p className="truncate text-xs text-neutral-500">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      {canManage && !isSelf ? (
                        <div className="relative w-28">
                          <select
                            aria-label={`Role for ${m.name ?? m.email}`}
                            value={m.role}
                            disabled={isBusy}
                            onChange={(e) => handleRoleChange(m, e.target.value as Role)}
                            className={cn(inputClasses, "h-7 cursor-pointer appearance-none pr-7 text-xs shadow-none ring-transparent hover:ring-neutral-200")}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                          <CaretDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" weight="bold" />
                        </div>
                      ) : (
                        <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                      )}
                    </td>
                    <td className={cn(TD, "hidden sm:table-cell")}>
                      <Badge tone={invited ? "amber" : "emerald"} dot>
                        {invited ? "Invited" : "Active"}
                      </Badge>
                    </td>
                    <td className={cn(TD, "hidden text-xs text-neutral-500 sm:table-cell")}>{shortDate(m.createdAt)}</td>
                    {canManage && (
                      <td className={cn(TD, "text-right")}>
                        {!isSelf && (
                          <IconButton
                            icon={Trash}
                            label="Remove member"
                            tone="danger"
                            busy={isBusy}
                            disabled={isBusy}
                            onClick={() => handleRemove(m)}
                            className={cn("ml-auto md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100", isBusy && "md:opacity-100")}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
