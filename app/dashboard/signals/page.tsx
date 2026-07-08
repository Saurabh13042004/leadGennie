import { Radio } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Signal Monitoring | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Signal Monitoring"
      description="Monitor buying signals"
      icon={Radio}
    />
  );
}
