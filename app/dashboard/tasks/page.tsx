import { CheckSquare } from "lucide-react";
import { auth } from "@/auth";
import { listTasks, getQueueCounts } from "@/lib/actions/tasks";
import TasksView from "@/components/tasks/TasksView";

export const metadata = {
  title: "Tasks | LeadGennie",
};

export default async function TasksPage() {
  const [session, tasks, counts] = await Promise.all([auth(), listTasks("my_open"), getQueueCounts()]);
  const canManage = session?.user?.role !== "viewer";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <CheckSquare className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Tasks</h1>
          <p className="text-sm text-neutral-500">CRM tasks & follow-ups</p>
        </div>
      </div>

      <TasksView initialQueue="my_open" initialTasks={tasks} counts={counts} canManage={canManage} />
    </div>
  );
}
