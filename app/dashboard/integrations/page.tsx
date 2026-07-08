import { Plug } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Integrations | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Integrations"
      description="Connect your tools"
      icon={Plug}
    />
  );
}
