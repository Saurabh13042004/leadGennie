"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react/ssr";
import Button, { type ButtonVariant } from "@/components/ui/Button";
import NewPromptModal from "./NewPromptModal";

/** "New prompt" button that owns its modal, so server pages can drop it into a header. */
export default function NewPromptButton({ variant = "primary" }: { variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" weight="bold" />
        New prompt
      </Button>
      {open && <NewPromptModal onClose={() => setOpen(false)} />}
    </>
  );
}
