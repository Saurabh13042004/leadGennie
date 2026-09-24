"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { dismissOnboarding } from "@/lib/actions/workspace-profile";

export default function DismissButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await dismissOnboarding(); router.refresh(); })}
      disabled={pending}
      className="text-neutral-500 hover:text-white disabled:opacity-50"
      aria-label="Dismiss setup checklist"
      title="Dismiss"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
