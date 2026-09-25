import { LockKey } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getApiTokenInfo } from "@/lib/actions/api-tokens";
import ApiCredentialsPanel from "@/components/dashboard/ApiCredentialsPanel";
import SettingsFrame from "@/components/settings/SettingsFrame";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "API Credentials | LeadGennie",
};

export default async function Page() {
  const session = await auth();
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";
  const description = "A shared workspace token for older extension installs. New installs connect with your account instead — see Browser extension.";

  if (!canManage) {
    return (
      <SettingsFrame title="API credentials" description={description}>
        <Card>
          <EmptyState
            compact
            icon={LockKey}
            title="Admin or owner role required"
            description="Ask a workspace admin or owner to manage the shared API token for this workspace."
          />
        </Card>
      </SettingsFrame>
    );
  }

  const info = await getApiTokenInfo();
  return (
    <SettingsFrame title="API credentials" description={description}>
      <ApiCredentialsPanel initialInfo={info} />
    </SettingsFrame>
  );
}
