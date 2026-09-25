import Link from "next/link";
import { Plus, SquaresFour, UploadSimple } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getInsightBoardData } from "@/lib/actions/insights";
import { getOnboardingChecklist } from "@/lib/actions/workspace-profile";
import { listActivities } from "@/lib/actions/activities";
import CommandCenter from "@/components/dashboard/CommandCenter";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";

export const metadata = {
  title: "Command Center | LeadGennie",
};

export default async function DashboardPage() {
  const session = await auth();
  const [data, checklist, activities] = await Promise.all([getInsightBoardData(), getOnboardingChecklist(), listActivities()]);
  const canDismiss = session?.user?.role !== "viewer";
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  return (
    <>
      <PageHeader
        title="Command Center"
        icon={SquaresFour}
        actions={
          <>
            <Link href="/dashboard/leads" className={buttonClasses({ variant: "secondary" })}>
              <UploadSimple className="h-4 w-4" weight="bold" />
              Import leads
            </Link>
            <Link href="/dashboard/campaigns/new" className={buttonClasses({ variant: "primary" })}>
              <Plus className="h-4 w-4" weight="bold" />
              New campaign
            </Link>
          </>
        }
      />
      <CommandCenter
        firstName={firstName}
        data={data}
        activities={activities}
        setup={checklist.visible ? <OnboardingChecklist checklist={checklist} canDismiss={canDismiss} /> : null}
      />
    </>
  );
}
