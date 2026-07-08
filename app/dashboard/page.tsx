import { auth } from "@/auth";
import { getInsightBoardData } from "@/lib/actions/insights";
import InsightBoard from "@/components/dashboard/InsightBoard";

export const metadata = {
  title: "Insight Board | LeadGennie",
};

export default async function DashboardPage() {
  const session = await auth();
  const data = await getInsightBoardData();

  return <InsightBoard userCompany={session?.user?.company} data={data} />;
}
