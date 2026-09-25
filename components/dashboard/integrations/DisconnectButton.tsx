"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectConnection } from "@/lib/actions/integrations";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/settings/bits";

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
    <Button size="xs" variant="ghost" onClick={handleClick} disabled={isPending} className="hover:bg-rose-50 hover:text-rose-600">
      {isPending && <Spinner className="h-3 w-3" />}
      Disconnect
    </Button>
  );
}
