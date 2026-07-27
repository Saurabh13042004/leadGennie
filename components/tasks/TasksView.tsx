"use client";

import { useState, useTransition } from "react";
import { Plus, Check, X as XIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { listTasks, completeTask, dismissTask, type Task, type TaskQueue } from "@/lib/actions/tasks";
import NewTaskModal from "./NewTaskModal";

const QUEUES: { key: TaskQueue; label: string }[] = [
  { key: "my_open", label: "My Open" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "ai_recommended", label: "AI Recommended" },
  { key: "completed", label: "Completed" },
  { key: "dismissed", label: "Dismissed" },
];

export default function TasksView({
  initialQueue,
  initialTasks,
  counts,
  canManage,
}: {
  initialQueue: TaskQueue;
  initialTasks: Task[];
  counts: Record<TaskQueue, number>;
  canManage: boolean;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, startLoading] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchQueue(next: TaskQueue) {
    setQueue(next);
    startLoading(async () => {
      const rows = await listTasks(next);
      setTasks(rows);
    });
  }

  async function refresh() {
    const rows = await listTasks(queue);
    setTasks(rows);
  }

  async function handleComplete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await completeTask(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete task");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await dismissTask(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss task");
    } finally {
      setBusyId(null);
    }
  }

  const isOpenQueue = queue !== "completed" && queue !== "dismissed";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1 flex-wrap">
          {QUEUES.map((q) => (
            <button
              key={q.key}
              onClick={() => switchQueue(q.key)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                queue === q.key
                  ? "bg-blue-500/10 border-blue-500/30 text-white"
                  : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              {q.label}
              <span className="text-[10px] text-neutral-500 tabular-nums">{counts[q.key]}</span>
            </button>
          ))}
        </div>

        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New task
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-16 px-6">
          <p className="text-white font-medium">Nothing here</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            {queue === "ai_recommended"
              ? "No agent-generated tasks yet — nothing in this workspace proposes tasks automatically until Flows or Signals are built."
              : "This queue is empty."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
          <div className="divide-y divide-white/5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{t.title}</p>
                  <p className="text-xs text-neutral-500 truncate">
                    {t.ownerName ? `${t.ownerName} · ` : ""}
                    {t.dueAt ? `due ${new Date(t.dueAt).toLocaleString()}` : "no due date"}
                    {t.source !== "manual" ? ` · ${t.source.replace("_", " ")}` : ""}
                  </p>
                  {t.outcome && <p className="text-xs text-neutral-600 mt-0.5">Outcome: {t.outcome}</p>}
                </div>
                {isOpenQueue && canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleComplete(t.id)}
                      disabled={busyId === t.id}
                      className="flex items-center gap-1.5 text-xs text-black bg-white hover:bg-neutral-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Complete
                    </button>
                    <button
                      onClick={() => handleDismiss(t.id)}
                      disabled={busyId === t.id}
                      className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label="Dismiss"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onCreated={async () => {
            setModalOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
