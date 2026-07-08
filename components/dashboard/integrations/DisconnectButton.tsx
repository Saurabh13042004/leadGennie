"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { disconnectConnection } from "@/lib/actions/integrations";

export default function DisconnectButton({ id }: { id: number }) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setIsPending(true);
    try {
      await disconnectConnection(id);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      Disconnect
    </button>
  );
}
