import { getOrCreateApiToken } from "@/lib/actions/api-tokens";
import ApiCredentialsPanel from "@/components/dashboard/ApiCredentialsPanel";

export const metadata = {
  title: "API Credentials | LeadGennie",
};

export default async function Page() {
  const token = await getOrCreateApiToken();
  return <ApiCredentialsPanel initialToken={token} />;
}
