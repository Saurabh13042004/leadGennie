import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

export const inputClasses =
  "w-full rounded-lg bg-white px-3 text-[13px] text-neutral-900 ring-1 ring-inset ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-neutral-400 transition-shadow hover:ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputClasses, "h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(inputClasses, "py-2 leading-relaxed", className)} {...rest} />;
});

/** Native select, restyled (keeps keyboard/a11y behaviour for free). */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(inputClasses, "h-9 cursor-pointer appearance-none pr-8")} {...rest}>
        {children}
      </select>
      <CaretDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" weight="bold" />
    </div>
  );
});

export function Label({ htmlFor, children, hint, className }: { htmlFor?: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-neutral-800">
        {children}
      </label>
      {hint && <span className="text-[11px] text-neutral-400">{hint}</span>}
    </div>
  );
}

export function Help({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-xs leading-relaxed text-neutral-500", className)}>{children}</p>;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-neutral-200 bg-white px-1 font-sans text-[10px] font-medium text-neutral-500 shadow-[0_1px_0_rgba(0,0,0,0.06)]", className)}>
      {children}
    </kbd>
  );
}
