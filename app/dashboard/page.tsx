import { auth } from "@/auth";
import InsightBoard from "@/components/dashboard/InsightBoard";

export const metadata = {
  title: "Insight Board | LeadGennie",
};

export default async function DashboardPage() {
  const session = await auth();

  return <InsightBoard userCompany={session?.user?.company} />;
}
