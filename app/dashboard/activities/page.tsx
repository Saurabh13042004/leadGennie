import { Activity } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Activities | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Activities"
      description="View activities"
      icon={Activity}
    />
  );
}
