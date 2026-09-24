import { auth } from "@/auth";
import { getGennieHomeAction } from "@/lib/actions/gennie";
import GennieHome from "@/components/gennie/GennieHome";

export const metadata = {
  title: "Ask Gennie | LeadGennie",
};

export default async function GennieHomePage() {
  const [session, gennie] = await Promise.all([auth(), getGennieHomeAction()]);
  const canPlan = session?.user?.role !== "viewer";

  return (
    <GennieHome
      suggestions={gennie.suggestions}
      recent={gennie.recent}
      leadCount={gennie.leadCount}
      engineAvailable={gennie.engineAvailable}
      canPlan={canPlan}
    />
  );
}
