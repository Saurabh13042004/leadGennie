import { Sparkle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: { box: "h-5 w-5 rounded-md", icon: "h-3 w-3" },
  sm: { box: "h-7 w-7 rounded-lg", icon: "h-3.5 w-3.5" },
  md: { box: "h-9 w-9 rounded-xl", icon: "h-4.5 w-4.5" },
  lg: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6" },
} as const;

/** Gennie's avatar: the violet→fuchsia sparkle, reserved for AI moments. */
export default function GennieMark({ size = "sm", glow, className }: { size?: keyof typeof SIZE; glow?: boolean; className?: string }) {
  const s = SIZE[size];
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {glow && <span aria-hidden className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-violet-400/30 via-fuchsia-400/20 to-transparent blur-xl" />}
      <span
        className={cn(
          "relative flex items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_8px_-2px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]",
          s.box,
        )}
      >
        <Sparkle className={s.icon} weight="fill" />
      </span>
    </span>
  );
}
