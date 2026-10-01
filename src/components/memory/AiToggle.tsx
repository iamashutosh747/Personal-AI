"use client";

import { useState, useTransition } from "react";
import { setMemoryFlags } from "@/lib/actions/memories";
import { cn } from "@/lib/cn";

export function AiToggle({ id, initial, label }: { id: string; initial: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={`AI may use “${label}”`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          await setMemoryFlags(id, { ai_access: !on });
        })
      }
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[12px] transition-colors",
        on ? "bg-accent-soft text-accent" : "border border-line text-ink-faint",
      )}
    >
      {on ? "AI can use" : "Private"}
    </button>
  );
}
