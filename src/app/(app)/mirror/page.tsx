import Link from "next/link";
import { requireViewer } from "@/lib/data";
import { ATTRIBUTE_KINDS, type Observation, type SelfAttribute } from "@/lib/types";
import { formatDate, todayIn } from "@/lib/time";
import { Page, PageHeader } from "@/components/ui/Page";
import { AttributeSection } from "@/components/mirror/Attributes";
import { MirrorObservations } from "@/components/mirror/MirrorObservations";
import { cn } from "@/lib/cn";

export const metadata = { title: "The Mirror" };

const THEN = { "3m": 91, "6m": 182, "1y": 365, "2y": 730 } as const;

export default async function MirrorPage({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const { then = "1y" } = await searchParams;
  const daysBack = THEN[then as keyof typeof THEN] ?? 365;
  const { supabase, profile } = await requireViewer();
  const today = todayIn(profile.timezone);

  const [{ data: attrs }, { data: observations }, { data: tagRows }] = await Promise.all([
    supabase.from("self_attributes").select("*").order("rank", { ascending: true, nullsFirst: false }).order("since").returns<SelfAttribute[]>(),
    supabase.from("observations").select("*").eq("scope", "mirror").order("created_at", { ascending: false }).limit(20).returns<Observation[]>(),
    supabase.from("memories").select("tags").limit(2000),
  ]);
  const all = attrs ?? [];
  const current = all.filter((a) => !a.until);
  const past = all.filter((a) => a.until);

  // Then and now: priorities that were current on a past date vs today.
  const thenDate = new Date(Date.parse(`${today}T12:00:00Z`) - daysBack * 86400000).toISOString().slice(0, 10);
  const activeOn = (a: SelfAttribute, d: string) => a.since <= d && (!a.until || a.until > d);
  const priorities = all.filter((a) => a.kind === "priority" || a.kind === "goal" || a.kind === "value");
  const thenList = priorities.filter((a) => activeOn(a, thenDate));
  const nowList = priorities.filter((a) => !a.until);

  // Interests over time.
  const interests = all.filter((a) => a.kind === "interest");
  const start = interests.length ? interests.map((a) => a.since).sort()[0]! : today;

  // Most-used tags: a factual count, not an interpretation.
  const counts = new Map<string, number>();
  for (const r of tagRows ?? []) for (const t of r.tags as string[]) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topTags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  const maxTag = topTags[0]?.[1] ?? 1;

  return (
    <Page>
      <PageHeader eyebrow="The Mirror" title="In your own words">
        A picture of you that only you draw. The AI can point things out, with its sources, but it never decides who you are.
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {ATTRIBUTE_KINDS.map((k) => (
          <AttributeSection key={k} kind={k} items={current.filter((a) => a.kind === k)} past={past.filter((a) => a.kind === k)} />
        ))}
      </div>

      <section className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-[34px]">Then and now</h2>
            <p className="mt-2 text-[14px] text-ink-faint">Your values, goals and priorities as they stood then, beside today. Built from the dates you gave.</p>
          </div>
          <nav className="flex gap-1 text-[13px]" aria-label="Compare with">
            {Object.keys(THEN).map((k) => (
              <Link key={k} href={`/mirror?then=${k}`} className={cn("rounded-full px-3 py-1.5", then === k ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink-soft")}>
                {k.replace("m", " months").replace("1y", "a year").replace("2y", "two years")} ago
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-2">
          {[
            { title: formatDate(thenDate), list: thenList, other: nowList, word: "since let go" },
            { title: "Today", list: nowList, other: thenList, word: "new since then" },
          ].map((col) => (
            <div key={col.title} className="bg-bg p-6">
              <p className="eyebrow">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.list.map((a) => {
                  const shared = col.other.some((o) => o.id === a.id);
                  return (
                    <li key={a.id} className="flex items-baseline justify-between gap-3">
                      <span className={cn("text-[15.5px]", shared ? "text-ink-soft" : "text-ink")}>
                        {a.label} <span className="text-[11px] text-ink-faint">{a.kind}</span>
                      </span>
                      {!shared && <span className="shrink-0 text-[11px] text-accent">{col.word}</span>}
                    </li>
                  );
                })}
                {col.list.length === 0 && <li className="font-serif text-[15px] text-ink-faint">Nothing recorded for this time.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {interests.length > 0 && (
        <section className="mt-20">
          <h2 className="display text-[34px]">Interests over time</h2>
          <InterestTimeline interests={interests} start={start} end={today} />
        </section>
      )}

      {topTags.length > 0 && (
        <section className="mt-20">
          <h2 className="display text-[34px]">What you keep returning to</h2>
          <p className="mt-2 text-[14px] text-ink-faint">The tags you use most in your Memory Garden. A count, nothing more.</p>
          <ul className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3">
            {topTags.map(([tag, n]) => (
              <li key={tag}>
                <Link
                  href={`/garden?view=archive&tag=${encodeURIComponent(tag)}`}
                  className="font-display text-ink-soft transition-colors hover:text-accent"
                  style={{ fontSize: `${18 + (n / maxTag) * 22}px` }}
                >
                  {tag}
                  <span className="ml-1 font-sans text-[11px] text-ink-faint">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-20">
        <MirrorObservations observations={observations ?? []} />
      </div>
    </Page>
  );
}

function InterestTimeline({ interests, start, end }: { interests: SelfAttribute[]; start: string; end: string }) {
  const t0 = Date.parse(start);
  const t1 = Math.max(Date.parse(end), t0 + 86400000 * 30);
  const x = (d: string) => ((Date.parse(d) - t0) / (t1 - t0)) * 100;
  return (
    <figure className="mt-6">
      <ul className="space-y-3">
        {interests.map((a) => {
          const left = x(a.since);
          const right = x(a.until ?? end);
          return (
            <li key={a.id} className="grid grid-cols-[140px_1fr] items-center gap-4 sm:grid-cols-[200px_1fr]">
              <span className={cn("truncate text-[14px]", a.until ? "text-ink-faint" : "text-ink")}>{a.label}</span>
              <span className="relative h-2 rounded-full bg-line" aria-label={`${a.label}: from ${formatDate(a.since)}${a.until ? ` to ${formatDate(a.until)}` : " to now"}`}>
                <span
                  className={cn("absolute inset-y-0 rounded-full", a.until ? "bg-ink-faint/60" : "bg-accent")}
                  style={{ left: `${left}%`, width: `${Math.max(1.5, right - left)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-3 grid grid-cols-[140px_1fr] gap-4 text-[11px] text-ink-faint sm:grid-cols-[200px_1fr]">
        <span />
        <span className="flex justify-between">
          <span>{formatDate(start, { month: "short", year: "numeric" })}</span>
          <span>now</span>
        </span>
      </figcaption>
    </figure>
  );
}
