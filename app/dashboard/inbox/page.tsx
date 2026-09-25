import { ChatCircleText, PaperPlaneTilt, PencilSimpleLine, Tag, Tray } from "@phosphor-icons/react/ssr";
import PlaceholderPage from "@/components/dashboard/PlaceholderPage";
import InboxSkeleton from "@/components/dashboard/placeholder/InboxSkeleton";

export const metadata = {
  title: "Inbox | LeadGennie",
};

export default function Page() {
  return (
    <PlaceholderPage
      title="Inbox"
      description="Replies and conversations"
      icon={Tray}
      heading="Replies will land here"
      body="Reply tracking isn't connected yet, so there's nothing to show — we won't fill this with sample conversations. Form submissions that need review are under Leads → Inbound."
      features={[
        { icon: ChatCircleText, title: "Replies, threaded to the lead", description: "Each reply is matched to its lead and campaign, and the sequence stops for that lead." },
        { icon: Tag, title: "Reply classification", description: "Interested, question, meeting request, out of office, unsubscribe — sorted for you." },
        { icon: PencilSimpleLine, title: "Drafted responses", description: "Gennie suggests a reply grounded in your research and notes. You edit it." },
        { icon: PaperPlaneTilt, title: "Approve to send", description: "Nothing goes out until you click send. Unsubscribes are honoured automatically." },
      ]}
      links={[
        { label: "Go to Campaigns", href: "/dashboard/campaigns" },
        { label: "Leads → Inbound", href: "/dashboard/leads/inbound" },
      ]}
      skeleton={<InboxSkeleton />}
    />
  );
}
