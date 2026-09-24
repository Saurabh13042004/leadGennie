import Link from "next/link";
import { Compass } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] flex flex-col items-center text-center py-16 px-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
          <Compass className="w-5 h-5 text-neutral-400" />
        </div>
        <h1 className="text-white font-medium">Page not found</h1>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          That page doesn&apos;t exist, or it isn&apos;t available in your workspace.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 text-sm text-neutral-300 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
