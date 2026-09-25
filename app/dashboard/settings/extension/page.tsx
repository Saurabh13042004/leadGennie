import { listExtensionSessions } from "@/lib/actions/extension";
import { extensionFeatures } from "@/lib/extension/features";
import SettingsFrame from "@/components/settings/SettingsFrame";
import ExtensionPanel from "@/components/extension/ExtensionPanel";

export const metadata = { title: "Browser extension | LeadGennie" };
export const dynamic = "force-dynamic";

export default async function ExtensionSettingsPage() {
  const view = await listExtensionSessions();
  const features = extensionFeatures();
  return (
    <SettingsFrame
      title="Browser extension"
      description="Capture prospects from any page into this workspace. It connects with your account — no tokens to copy."
    >
      <ExtensionPanel view={view} automation={features.linkedinAutomation} />
    </SettingsFrame>
  );
}
