"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import Button, { type ButtonVariant } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** "Get Early Access" CTA that opens the demo request dialog. */
export default function EarlyAccessButton({ variant = "primary", className }: { variant?: ButtonVariant; className?: string }) {
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setIsAccessOpen(true)} className={cn("h-10 gap-2 px-4 text-sm", className)}>
        Get Early Access
        <ArrowRight className="h-3.5 w-3.5" weight="bold" />
      </Button>
      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
