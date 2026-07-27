"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Table, Kanban, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deal, Stage } from "@/lib/actions/deals";
import type { Lead } from "@/lib/actions/leads";
import DealsBoard from "./DealsBoard";
import DealsTable from "./DealsTable";
import NewDealModal from "./NewDealModal";

type View = "board" | "table";

export default function DealsView({
  stages,
  initialDeals,
  leads,
  canCreate,
}: {
  stages: Stage[];
  initialDeals: Deal[];
  leads: Lead[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("board");
  const [deals, setDeals] = useState(initialDeals);
  const [modalOpen, setModalOpen] = useState(false);

  // Re-sync when the server refetches (e.g. after router.refresh()) without a
  // separate effect — this is React's documented pattern for adjusting state
  // to a changed prop during render rather than after commit.
  const [prevInitialDeals, setPrevInitialDeals] = useState(initialDeals);
  if (initialDeals !== prevInitialDeals) {
    setPrevInitialDeals(initialDeals);
    setDeals(initialDeals);
  }

  const totalValue = deals.reduce((acc, d) => acc + d.value, 0);
  const openDeals = deals.filter((d) => d.status === "open");
  const wonDeals = deals.filter((d) => d.status === "won");

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-white tabular-nums">${totalValue.toLocaleString()}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Total pipeline</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-white tabular-nums">{openDeals.length}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Open deals</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-green-400 tabular-nums">{wonDeals.length}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Won</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-white tabular-nums">
            {deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0}%
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">Win rate</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1">
          <button
            onClick={() => setView("board")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors",
              view === "board" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white"
            )}
          >
            <Kanban className="w-3.5 h-3.5" />
            Board
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors",
              view === "table" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white"
            )}
          >
            <Table className="w-3.5 h-3.5" />
            Table
          </button>
        </div>

        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New deal
          </button>
        )}
      </div>

      {deals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">No deals yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Deals are only created when you explicitly ask — AI can suggest a starting point, never commit one on
            its own.
          </p>
        </div>
      ) : view === "board" ? (
        <DealsBoard stages={stages} deals={deals} onChanged={setDeals} />
      ) : (
        <DealsTable deals={deals} />
      )}

      {modalOpen && (
        <NewDealModal
          stages={stages}
          leads={leads}
          defaultStageId={stages[0]?.id}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
