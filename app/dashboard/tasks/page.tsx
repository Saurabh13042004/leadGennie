import { CheckSquare } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Tasks | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Tasks"
      description="CRM tasks & follow-ups"
      icon={CheckSquare}
    />
  );
}
