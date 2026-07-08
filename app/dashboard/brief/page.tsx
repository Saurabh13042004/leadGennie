import { Sun } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Today's Brief | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Today's Brief"
      description="Meetings, tasks, and signals"
      icon={Sun}
    />
  );
}
