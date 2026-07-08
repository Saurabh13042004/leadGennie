import { Inbox } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Unified Inbox | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Unified Inbox"
      description="Aggregated email conversations"
      icon={Inbox}
    />
  );
}
