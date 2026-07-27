import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { auth } from "@/auth";
import { getPromptDetail } from "@/lib/actions/prompts";
import PromptDetailView from "@/components/prompts/PromptDetailView";

export const metadata = {
  title: "Prompt | LeadGennie",
};

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, detail] = await Promise.all([auth(), getPromptDetail(Number(id))]);
  const canManage = session?.user?.role !== "viewer";
  const canApprove = session?.user?.role === "owner" || session?.user?.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link
        href="/dashboard/ai-prompts"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{detail.prompt.name}</h1>
          <p className="text-sm text-neutral-500 capitalize">
            {detail.prompt.type.replace("_", " ")}
            {detail.prompt.channel ? ` · ${detail.prompt.channel}` : ""}
          </p>
        </div>
      </div>

      <PromptDetailView versions={detail.versions} canManage={canManage} canApprove={canApprove} />
    </div>
  );
}
