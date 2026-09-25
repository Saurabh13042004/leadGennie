import { auth } from "@/auth";
import { getProfile } from "@/lib/actions/workspace-profile";
import { getTone } from "@/lib/actions/personalization";
import ToneSetting from "@/components/settings/ToneSetting";
import PositioningForm from "@/components/settings/PositioningForm";
import SettingsFrame from "@/components/settings/SettingsFrame";

export const metadata = {
  title: "Positioning & ICP | LeadGennie",
};

export default async function PositioningPage() {
  const [session, profile, tone] = await Promise.all([auth(), getProfile(), getTone()]);
  const role = session?.user?.role;
  const canEdit = role === "owner" || role === "admin";

  return (
    <SettingsFrame title="Positioning & ICP" description="What you sell and who you sell to — shared by everyone in this workspace.">
      <div className="space-y-5">
        <PositioningForm initial={profile} canEdit={canEdit} />
        <ToneSetting initial={tone} canEdit={canEdit} />
      </div>
    </SettingsFrame>
  );
}
