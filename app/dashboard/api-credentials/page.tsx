import { KeyRound } from "lucide-react";
import { auth } from "@/auth";
import { getApiTokenInfo } from "@/lib/actions/api-tokens";
import ApiCredentialsPanel from "@/components/dashboard/ApiCredentialsPanel";

export const metadata = {
  title: "API Credentials | LeadGennie",
};

export default async function Page() {
  const session = await auth();
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";

  if (!canManage) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="flex items-start gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">API Credentials</h1>
            <p className="text-sm text-neutral-500">Secure API access</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-neutral-900 font-semibold">Admin or owner role required</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Ask a workspace admin or owner to manage the shared API token for this workspace.
          </p>
        </div>
      </div>
    );
  }

  const info = await getApiTokenInfo();
  return <ApiCredentialsPanel initialInfo={info} />;
}
