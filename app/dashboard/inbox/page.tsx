import { Inbox } from "lucide-react";
import PlaceholderPage from "@/components/dashboard/PlaceholderPage";

export const metadata = {
  title: "Inbox | LeadGennie",
};

export default function Page() {
  return (
    <PlaceholderPage
      title="Inbox"
      description="Replies and conversations"
      icon={Inbox}
      heading="Replies will appear here"
      body="Reply tracking and classification aren't connected yet, so there is nothing to show — we won't fill this with sample conversations. Form submissions that need review are under Leads → Inbound."
      links={[{ label: "Go to Leads → Inbound", href: "/dashboard/leads/inbound" }]}
    />
  );
}
