import { KeyRound } from "lucide-react";
import { auth } from "@/auth";
import { getOrCreateApiToken } from "@/lib/actions/api-tokens";
import ApiCredentialsPanel from "@/components/dashboard/ApiCredentialsPanel";

export const metadata = {
  title: "API Credentials | LeadGennie",
};

export default async function Page() {
  const session = await auth();
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";

  if (!canManage) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">API Credentials</h1>
            <p className="text-sm text-neutral-500">Secure API access</p>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">Admin or owner role required</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Ask a workspace admin or owner to manage the shared API token for this workspace.
          </p>
        </div>
      </div>
    );
  }

  const token = await getOrCreateApiToken();
  return <ApiCredentialsPanel initialToken={token} />;
}
