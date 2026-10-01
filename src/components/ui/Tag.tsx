import { cn } from "@/lib/cn";

export function Tag({ children, className, tone = "default" }: { children: React.ReactNode; className?: string; tone?: "default" | "accent" | "ai" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] tracking-wide",
        tone === "default" && "border border-line text-ink-soft",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "ai" && "border border-dashed border-accent-2/50 text-accent-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks any AI-generated text so it is never mistaken for the user's own words. */
export function AiLabel({ label }: { label: "observation" | "hypothesis" | "summary" | "question" | "suggestion" }) {
  return (
    <Tag tone="ai">
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        <path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" fill="currentColor" />
      </svg>
      AI {label}
    </Tag>
  );
}
