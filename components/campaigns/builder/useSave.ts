"use client";

import { useState, useTransition } from "react";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import type { Envelope } from "./ui";

/** Save-a-section helper: pending flag, error/success message, and hands the fresh view back to the builder. */
export function useSave(onSaved: (v: BuilderView) => void) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  function save(work: () => Promise<Envelope<BuilderView>>, okText = "Saved.") {
    setMessage(null);
    start(async () => {
      const res = await work();
      if (!res.ok) return setMessage({ ok: false, text: res.error.message });
      onSaved(res.data);
      setMessage({ ok: true, text: okText });
    });
  }
  return { pending, message, save };
}
