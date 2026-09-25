import { ChartBar, ChartLineUp, Funnel, Megaphone, Tray } from "@phosphor-icons/react/ssr";
import PlaceholderPage from "@/components/dashboard/PlaceholderPage";
import AnalyticsSkeleton from "@/components/dashboard/placeholder/AnalyticsSkeleton";

export const metadata = {
  title: "Analytics | LeadGennie",
};

export default function Page() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Outbound performance"
      icon={ChartLineUp}
      heading="Analytics are on the way"
      body="Reporting will be built from real send, reply and suppression events — never estimates. Until then, live campaign counts are on the Command Center and the Campaigns page."
      features={[
        { icon: Funnel, title: "Outbound funnel", description: "Sent, delivered, replied, interested and meetings — each with its definition on the page." },
        { icon: Megaphone, title: "Campaign comparison", description: "Side-by-side results per campaign, with counts shown instead of rates on small samples." },
        { icon: Tray, title: "Reply breakdown", description: "What people said, by reply classification, once the Inbox is live." },
        { icon: ChartBar, title: "Trends over time", description: "Daily rollups in your workspace's time zone." },
      ]}
      links={[
        { label: "Command Center", href: "/dashboard" },
        { label: "Campaigns", href: "/dashboard/campaigns" },
      ]}
      skeleton={<AnalyticsSkeleton />}
    />
  );
}
