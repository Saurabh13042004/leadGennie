import { Database } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Knowledge Sources | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Knowledge Sources"
      description="Manage data sources"
      icon={Database}
    />
  );
}
