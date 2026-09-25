import { auth } from "@/auth";
import { listPrompts } from "@/lib/actions/prompts";
import PromptsListView from "@/components/prompts/PromptsListView";
import NewPromptButton from "@/components/prompts/NewPromptButton";
import SettingsFrame from "@/components/settings/SettingsFrame";

export const metadata = {
  title: "AI Message Prompts | LeadGennie",
};

export default async function Page() {
  const [session, prompts] = await Promise.all([auth(), listPrompts()]);
  const canCreate = session?.user?.role !== "viewer";

  return (
    <SettingsFrame
      wide
      title="AI prompts"
      description="Versioned prompts used to write messages. Each version is tested and approved before it goes live."
      actions={canCreate && prompts.length > 0 ? <NewPromptButton /> : undefined}
    >
      <PromptsListView prompts={prompts} canCreate={canCreate} />
    </SettingsFrame>
  );
}
