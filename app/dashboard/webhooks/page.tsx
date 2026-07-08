import { Webhook } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Webhooks | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Webhooks"
      description="Manage webhook endpoints"
      icon={Webhook}
    />
  );
}
