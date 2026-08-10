import { listWorkflows } from "@/lib/actions/workflows";
import { listAudienceOptions } from "@/lib/actions/campaigns";
import WorkflowsListView from "@/components/workflows/WorkflowsListView";

export const metadata = {
  title: "Agentic Flows | LeadGennie",
};

export default async function Page() {
  const [workflows, audiences] = await Promise.all([listWorkflows(), listAudienceOptions()]);
  return <WorkflowsListView initialWorkflows={workflows} audiences={audiences} />;
}
