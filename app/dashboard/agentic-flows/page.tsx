import { Workflow } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Agentic Flows | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Agentic Flows"
      description="Build & deploy autonomous agents"
      icon={Workflow}
    />
  );
}
