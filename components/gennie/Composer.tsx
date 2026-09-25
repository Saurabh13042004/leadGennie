"use client";

import type { ReactNode, RefObject } from "react";
import { ArrowUp, CircleNotch } from "@phosphor-icons/react/ssr";
import { Kbd } from "@/components/ui/Field";
import { PROMPT_MAX_LENGTH, PROMPT_MIN_LENGTH } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

/**
 * The big rounded prompt box: auto-growing textarea, send button, Enter to send. Purely presentational —
 * the owner holds the value and decides what "submit" means.
 */
export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  placeholder,
  inputRef,
  footer,
  size = "lg",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** Left side of the bottom toolbar (hints, notes). Large size only. */
  footer?: ReactNode;
  size?: "lg" | "md";
}) {
  const canSend = !disabled && !busy && value.trim().length >= PROMPT_MIN_LENGTH;

  const lg = size === "lg";
  const send = (
    <>
      <span className="hidden items-center gap-1 sm:flex" aria-hidden>
        <Kbd>↵</Kbd>
        <span className="text-[11px] text-neutral-400">to plan</span>
      </span>
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Plan it"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
          canSend
            ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_2px_8px_-2px_rgba(124,58,237,0.6)] hover:brightness-110"
            : "bg-neutral-100 text-neutral-400",
        )}
      >
        {busy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <ArrowUp className="h-4 w-4" weight="bold" />}
      </button>
    </>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className={cn(
        "group rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(20,20,40,0.10)] transition-[border-color,box-shadow]",
        "focus-within:border-violet-300 focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_4px_rgba(139,92,246,0.10),0_8px_24px_-8px_rgba(91,33,182,0.18)]",
        !lg && "flex items-end gap-2 py-1.5 pl-1 pr-2",
        disabled && "bg-neutral-50",
      )}
    >
      <label htmlFor="gennie-prompt" className="sr-only">What should Gennie do?</label>
      <textarea
        id="gennie-prompt"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends (Shift+Enter for a new line), like every chat app; skip while an IME is composing.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        maxLength={PROMPT_MAX_LENGTH}
        disabled={disabled || busy}
        placeholder={placeholder}
        rows={lg ? 2 : 1}
        className={cn(
          "block w-full resize-none bg-transparent px-3 text-neutral-900 [field-sizing:content] placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
          lg ? "max-h-64 min-h-[76px] px-4 pb-1 pt-4 text-[15px] leading-relaxed" : "max-h-40 min-h-9 flex-1 py-1.5 text-[14px] leading-relaxed",
        )}
      />
      {lg ? (
        <div className="flex items-center gap-3 px-3 pb-3 pt-1">
          <div className="min-w-0 flex-1 truncate pl-1 text-[12px] text-neutral-400">{footer}</div>
          {send}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 pb-0.5">{send}</div>
      )}
    </form>
  );
}
