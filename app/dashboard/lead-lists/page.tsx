import { List } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Lead Lists | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Lead Lists"
      description="Organize lead groups"
      icon={List}
    />
  );
}
