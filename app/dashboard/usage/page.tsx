import { BarChart3 } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Usage Report | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Usage Report"
      description="Activity charts & metrics"
      icon={BarChart3}
    />
  );
}
