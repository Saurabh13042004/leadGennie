"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; title: string; num?: string };

/** "On this page" list with scroll-spy: highlights the section nearest the top of the viewport. */
export default function LegalToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = items[0]?.id;
      for (const i of items) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= 140) current = i.id;
      }
      setActive(atBottom ? items[items.length - 1]?.id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  return (
    <nav aria-label="On this page">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500">On this page</p>
      <ol className="space-y-0.5 border-l border-neutral-200">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "location" : undefined}
              className={cn(
                "-ml-px flex gap-2 border-l py-1.5 pl-3.5 text-[13px] leading-snug transition-colors",
                active === i.id ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800",
              )}
            >
              {i.num && <span className="w-4 shrink-0 tabular-nums text-neutral-400">{i.num}</span>}
              {i.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
