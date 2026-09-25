import { auth } from "@/auth";
import { getPromptDetail } from "@/lib/actions/prompts";
import PromptDetailView from "@/components/prompts/PromptDetailView";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { typeLabel } from "@/components/prompts/meta";

export const metadata = {
  title: "Prompt | LeadGennie",
};

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, detail] = await Promise.all([auth(), getPromptDetail(Number(id))]);
  const canManage = session?.user?.role !== "viewer";
  const canApprove = session?.user?.role === "owner" || session?.user?.role === "admin";

  return (
    <SettingsFrame
      wide
      title={detail.prompt.name}
      crumbs={[{ label: "AI prompts", href: "/dashboard/ai-prompts" }]}
      description={`${typeLabel(detail.prompt.type)}${detail.prompt.channel ? ` · ${detail.prompt.channel}` : ""} · ${detail.versions.length} version${detail.versions.length === 1 ? "" : "s"}`}
    >
      <PromptDetailView versions={detail.versions} canManage={canManage} canApprove={canApprove} />
    </SettingsFrame>
  );
}
