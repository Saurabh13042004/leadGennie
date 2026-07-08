import { Handshake } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Deals | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Deals"
      description="View deals"
      icon={Handshake}
    />
  );
}
