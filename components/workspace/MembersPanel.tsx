"use client";

import { useState, useTransition } from "react";
import { UserPlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inviteMember, removeMember, updateMemberRole, type Member } from "@/lib/actions/workspace";
import type { Role } from "@/lib/workspace";

const ROLES: Role[] = ["owner", "admin", "member", "viewer"];
const INVITABLE_ROLES: Role[] = ["admin", "member", "viewer"];

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

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
  const [inviting, startInvite] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startInvite(async () => {
      try {
        await inviteMember(email, role);
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

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 flex flex-col sm:flex-row gap-2 items-start sm:items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-sm text-neutral-300 mb-1.5">Invite by email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-300 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-white/5 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 shrink-0"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                const isBusy = busyId === m.id;
                return (
                  <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-white">{m.name ?? m.email}</p>
                      {m.name && <p className="text-xs text-neutral-500">{m.email}</p>}
                      {isSelf && <span className="text-[11px] text-blue-400">You</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && !isSelf ? (
                        <select
                          value={m.role}
                          disabled={isBusy}
                          onChange={(e) => handleRoleChange(m, e.target.value as Role)}
                          className="bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-neutral-300 border border-white/10 rounded-full px-2.5 py-1">
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs border rounded-full px-2.5 py-1",
                          m.status === "active"
                            ? "bg-green-500/10 text-green-300 border-green-500/20"
                            : "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                        )}
                      >
                        {m.status === "active" ? "Active" : "Invited"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleRemove(m)}
                            disabled={isBusy}
                            className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                            aria-label="Remove member"
                          >
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
