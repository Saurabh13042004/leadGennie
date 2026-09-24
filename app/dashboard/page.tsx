import { auth } from "@/auth";
import { getInsightBoardData } from "@/lib/actions/insights";
import { getOnboardingChecklist } from "@/lib/actions/workspace-profile";
import InsightBoard from "@/components/dashboard/InsightBoard";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

export const metadata = {
  title: "Insight Board | LeadGennie",
};

export default async function DashboardPage() {
  const session = await auth();
  const [data, checklist] = await Promise.all([getInsightBoardData(), getOnboardingChecklist()]);
  const canDismiss = session?.user?.role !== "viewer";

  return (
    <>
      {checklist.visible && (
        <div className="px-4 md:px-8 pt-4 md:pt-8 max-w-7xl mx-auto">
          <OnboardingChecklist checklist={checklist} canDismiss={canDismiss} />
        </div>
      )}
      <InsightBoard userCompany={session?.user?.company} data={data} />
    </>
  );
}
