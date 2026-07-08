import { Calendar } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "Meetings | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="Meetings"
      description="Upcoming and past meetings"
      icon={Calendar}
    />
  );
}
