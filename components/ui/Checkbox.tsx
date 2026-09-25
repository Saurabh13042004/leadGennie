import type { InputHTMLAttributes } from "react";
import { Check } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** Native checkbox (keeps a11y/keyboard) with a custom box and tick. */
export default function Checkbox({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0 align-middle", className)}>
      <input
        type="checkbox"
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[5px] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-neutral-300 transition-colors checked:bg-indigo-600 checked:ring-indigo-600 hover:ring-neutral-400 checked:hover:ring-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
        {...rest}
      />
      <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100" weight="bold" />
    </span>
  );
}
