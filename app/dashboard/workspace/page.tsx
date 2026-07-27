import { UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { listMembers, getWorkspaceInfo } from "@/lib/actions/workspace";
import MembersPanel from "@/components/workspace/MembersPanel";

export const metadata = {
  title: "Workspace | LeadGennie",
};

export default async function WorkspacePage() {
  const [session, members, info] = await Promise.all([auth(), listMembers(), getWorkspaceInfo()]);
  const canManage = info.role === "owner" || info.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <UsersRound className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{info.name}</h1>
          <p className="text-sm text-neutral-500">Team members & roles</p>
        </div>
      </div>

      <MembersPanel
        initialMembers={members}
        currentUserId={Number(session!.user.id)}
        canManage={canManage}
      />
    </div>
  );
}
