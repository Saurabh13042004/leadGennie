import { BarChart3 } from "lucide-react";
import PlaceholderPage from "@/components/dashboard/PlaceholderPage";

export const metadata = {
  title: "Analytics | LeadGennie",
};

export default function Page() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Outbound performance"
      icon={BarChart3}
      heading="Analytics are on the way"
      body="Funnel and per-campaign reporting will be built from real send, reply and suppression events. Until then, live campaign counts are on the Command Center and the Campaigns page."
      links={[
        { label: "Command Center", href: "/dashboard" },
        { label: "Campaigns", href: "/dashboard/campaigns" },
      ]}
    />
  );
}
