import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "xs" | "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-neutral-800",
  secondary:
    "bg-white text-neutral-800 ring-1 ring-inset ring-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 hover:ring-neutral-300",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-white text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  accent:
    "bg-indigo-600 text-white shadow-[0_1px_2px_rgba(79,70,229,0.3),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-indigo-500",
};

const SIZE: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
};

/** Class string for anything that should look like a button (e.g. a Next <Link>). */
export function buttonClasses({ variant = "secondary", size = "sm", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant, size, className, type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...rest} />;
});

export default Button;
