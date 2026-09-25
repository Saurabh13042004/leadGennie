import { auth } from "@/auth";
import { listMembers, getWorkspaceInfo } from "@/lib/actions/workspace";
import MembersPanel from "@/components/workspace/MembersPanel";
import SettingsFrame from "@/components/settings/SettingsFrame";

export const metadata = {
  title: "Workspace | LeadGennie",
};

export default async function WorkspacePage() {
  const [session, members, info] = await Promise.all([auth(), listMembers(), getWorkspaceInfo()]);
  const canManage = info.role === "owner" || info.role === "admin";

  return (
    <SettingsFrame title="Members" description={`Who has access to ${info.name}, and what they can do.`}>
      <MembersPanel initialMembers={members} currentUserId={Number(session!.user.id)} canManage={canManage} />
    </SettingsFrame>
  );
}
