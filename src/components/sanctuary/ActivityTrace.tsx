import { formatDate } from "@/lib/time";

/** Fourteen days as a quiet line of lights: brighter where you were here. */
export function ActivityTrace({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <figure className="mt-5">
      <div className="flex items-end justify-between gap-1.5" role="img" aria-label={`${total} things written or kept in the last 14 days`}>
        {days.map((d) => {
          const v = d.count / max;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-2" title={`${formatDate(d.date, { day: "numeric", month: "short" })}: ${d.count}`}>
              <div className="flex h-14 w-full items-end justify-center">
                <div
                  className="w-full max-w-[14px] rounded-full transition-all"
                  style={{
                    height: d.count ? `${18 + v * 82}%` : "3px",
                    background: d.count ? `color-mix(in oklab, var(--accent) ${35 + v * 65}%, transparent)` : "var(--line-strong)",
                    boxShadow: d.count ? `0 0 ${6 + v * 14}px -2px var(--accent)` : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 flex justify-between text-[11px] text-ink-faint">
        <span>{formatDate(days[0]!.date, { day: "numeric", month: "short" })}</span>
        <span>{total === 0 ? "A quiet fortnight" : `${total} moments of attention`}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
