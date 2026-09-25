import { auth } from "@/auth";
import { getProfile } from "@/lib/actions/workspace-profile";
import { getTone } from "@/lib/actions/personalization";
import { getSenderIdentity } from "@/lib/actions/sending";
import SenderIdentitySetting from "@/components/settings/SenderIdentitySetting";
import ToneSetting from "@/components/settings/ToneSetting";
import PositioningForm from "@/components/settings/PositioningForm";
import SettingsFrame from "@/components/settings/SettingsFrame";

export const metadata = {
  title: "Positioning & ICP | LeadGennie",
};

export default async function PositioningPage() {
  const [session, profile, tone, identity] = await Promise.all([auth(), getProfile(), getTone(), getSenderIdentity()]);
  const role = session?.user?.role;
  const canEdit = role === "owner" || role === "admin";

  return (
    <SettingsFrame title="Positioning & ICP" description="What you sell and who you sell to — shared by everyone in this workspace.">
      <div className="space-y-5">
        <PositioningForm initial={profile} canEdit={canEdit} />
        <ToneSetting initial={tone} canEdit={canEdit} />
        <SenderIdentitySetting initial={identity} canEdit={canEdit} />
      </div>
    </SettingsFrame>
  );
}
