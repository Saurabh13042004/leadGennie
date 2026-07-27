import { Handshake } from "lucide-react";
import { auth } from "@/auth";
import { getPipeline, listDeals } from "@/lib/actions/deals";
import { listLeads } from "@/lib/actions/leads";
import DealsView from "@/components/deals/DealsView";

export const metadata = {
  title: "Deals | LeadGennie",
};

export default async function DealsPage() {
  const [session, pipeline, deals, leads] = await Promise.all([
    auth(),
    getPipeline(),
    listDeals(),
    listLeads(),
  ]);
  const canCreate = session?.user?.role !== "viewer";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Handshake className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Deals</h1>
          <p className="text-sm text-neutral-500">{pipeline.name}</p>
        </div>
      </div>

      <DealsView stages={pipeline.stages} initialDeals={deals} leads={leads} canCreate={canCreate} />
    </div>
  );
}
