import { auth } from "@/auth";
import { listDncEntries } from "@/lib/actions/dnc";
import DncPanel from "@/components/dnc/DncPanel";
import SettingsFrame from "@/components/settings/SettingsFrame";

export const metadata = {
  title: "Do Not Contact | LeadGennie",
};

export default async function Page() {
  const [session, entries] = await Promise.all([auth(), listDncEntries()]);
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";

  return (
    <SettingsFrame title="Do Not Contact" description="People who must never receive outreach from this workspace.">
      <DncPanel initialEntries={entries} canManage={canManage} />
    </SettingsFrame>
  );
}
