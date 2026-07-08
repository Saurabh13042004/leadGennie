import { Bell } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Notifications | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Notifications"
      description="Notification preferences"
      icon={Bell}
    />
  );
}
