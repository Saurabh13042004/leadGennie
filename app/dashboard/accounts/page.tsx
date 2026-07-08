import { Building2 } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Accounts | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Accounts"
      description="View accounts"
      icon={Building2}
    />
  );
}
