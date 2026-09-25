import NavTabs from "@/components/ui/NavTabs";

const TABS = [
  { label: "All leads", href: "/dashboard/leads", exact: true },
  { label: "Audiences", href: "/dashboard/lead-lists" },
  { label: "Inbound", href: "/dashboard/leads/inbound" },
  { label: "Email drafts", href: "/dashboard/leads/drafts" },
];

/** Leads is one destination with four views; this keeps them reachable now that the sidebar has one entry. */
export default function LeadsSubNav() {
  return <NavTabs tabs={TABS} />;
}
