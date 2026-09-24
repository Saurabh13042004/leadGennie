import { MessageSquare } from "lucide-react";
import { auth } from "@/auth";
import { listPrompts } from "@/lib/actions/prompts";
import PromptsListView from "@/components/prompts/PromptsListView";

export const metadata = {
  title: "AI Message Prompts | LeadGennie",
};

export default async function Page() {
  const [session, prompts] = await Promise.all([auth(), listPrompts()]);
  const canCreate = session?.user?.role !== "viewer";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">AI Message Prompts</h1>
          <p className="text-sm text-neutral-500">Train and tune autonomous agents</p>
        </div>
      </div>

      <PromptsListView prompts={prompts} canCreate={canCreate} />
    </div>
  );
}
