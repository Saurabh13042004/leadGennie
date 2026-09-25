"use client";

import { useTransition } from "react";
import { X } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { dismissOnboarding } from "@/lib/actions/workspace-profile";

export default function DismissButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await dismissOnboarding(); router.refresh(); })}
      disabled={pending}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
      aria-label="Dismiss setup checklist"
      title="Dismiss"
    >
      <X className="h-4 w-4" weight="bold" />
    </button>
  );
}
