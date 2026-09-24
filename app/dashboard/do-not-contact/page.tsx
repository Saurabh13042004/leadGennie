import { Ban } from "lucide-react";
import { auth } from "@/auth";
import { listDncEntries } from "@/lib/actions/dnc";
import DncPanel from "@/components/dnc/DncPanel";

export const metadata = {
  title: "Do Not Contact | LeadGennie",
};

export default async function Page() {
  const [session, entries] = await Promise.all([auth(), listDncEntries()]);
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Ban className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Do Not Contact</h1>
          <p className="text-sm text-neutral-500">Exclusion list</p>
        </div>
      </div>

      <DncPanel initialEntries={entries} canManage={canManage} />
    </div>
  );
}
