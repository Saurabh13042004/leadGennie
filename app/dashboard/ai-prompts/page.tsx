import { MessageSquare } from "lucide-react";
import ComingSoon from "@/components/dashboard/ComingSoon";

export const metadata = {
  title: "AI Message Prompts | LeadGennie",
};

export default function Page() {
  return (
    <ComingSoon
      title="AI Message Prompts"
      description="Train and tune autonomous agents"
      icon={MessageSquare}
    />
  );
}
