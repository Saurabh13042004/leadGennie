import { RefreshCw } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "CRM Sync | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="CRM Sync"
      description="Sync with CRM systems"
      icon={RefreshCw}
    />
  );
}
