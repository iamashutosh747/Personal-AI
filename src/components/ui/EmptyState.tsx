import { cn } from "@/lib/cn";

/** A room that has nothing in it yet should still feel like a room. */
export function EmptyState({
  title,
  children,
  action,
  glyph,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  glyph?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center py-16 text-center", className)}>
      <div className="mb-6 text-accent/70" aria-hidden>
        {glyph ?? (
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <circle cx="28" cy="28" r="27" stroke="currentColor" strokeOpacity=".25" />
            <circle cx="28" cy="28" r="3" fill="currentColor" />
            <circle cx="16" cy="20" r="1.2" fill="currentColor" fillOpacity=".6" />
            <circle cx="40" cy="36" r="1.2" fill="currentColor" fillOpacity=".6" />
            <path d="M16 20 28 28 40 36" stroke="currentColor" strokeOpacity=".3" />
          </svg>
        )}
      </div>
      <h3 className="display text-[28px] text-ink">{title}</h3>
      <div className="mt-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
