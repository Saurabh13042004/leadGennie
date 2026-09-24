import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { auth } from "@/auth";
import { getProfile } from "@/lib/actions/workspace-profile";
import PositioningForm from "@/components/settings/PositioningForm";

export const metadata = {
  title: "Positioning & ICP | LeadGennie",
};

export default async function PositioningPage() {
  const [session, profile] = await Promise.all([auth(), getProfile()]);
  const role = session?.user?.role;
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Settings
      </Link>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Target className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Positioning &amp; ICP</h1>
          <p className="text-sm text-neutral-500">What you sell and who you sell to — shared by everyone in this workspace.</p>
        </div>
      </div>
      <PositioningForm initial={profile} canEdit={canEdit} />
    </div>
  );
}
