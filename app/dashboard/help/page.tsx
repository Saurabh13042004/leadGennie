import { LifeBuoy } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Help & Support | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Help & Support"
      description="Get assistance"
      icon={LifeBuoy}
    />
  );
}
