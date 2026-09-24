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

const inputCls =
  "w-full rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";
const selectCls =
  "bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";

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
          className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
        >
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Invite by email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={selectCls}
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
            className="flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 shrink-0"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Invite
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {members.map((m) => {
                const isSelf = m.userId === currentUserId;
                const isBusy = busyId === m.id;
                return (
                  <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-neutral-900">{m.name ?? m.email}</p>
                      {m.name && <p className="text-xs text-neutral-500">{m.email}</p>}
                      {isSelf && <span className="text-[11px] font-medium text-indigo-600">You</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && !isSelf ? (
                        <select
                          value={m.role}
                          disabled={isBusy}
                          onChange={(e) => handleRoleChange(m, e.target.value as Role)}
                          className="bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            "text-xs font-medium rounded-full px-2.5 py-1 ring-1 ring-inset",
                            m.role === "owner"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-neutral-100 text-neutral-600 ring-neutral-200"
                          )}
                        >
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium rounded-full px-2.5 py-1 ring-1 ring-inset",
                          m.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-amber-50 text-amber-700 ring-amber-200"
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
                            className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
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
