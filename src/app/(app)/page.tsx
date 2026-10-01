import Link from "next/link";
import { ArrowUpRight, Hourglass } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { greetingFor, hourIn, todayIn, formatDate, relativeTime } from "@/lib/time";
import { promptForDate } from "@/lib/prompts";
import { pickMoment, type MomentCandidate } from "@/lib/rediscovery";
import { MEMORY_KIND_LABELS, type Capsule, type MemoryKind } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { AskField } from "@/components/sanctuary/AskField";
import { ActivityTrace } from "@/components/sanctuary/ActivityTrace";

export default async function Sanctuary() {
  const { supabase, profile } = await requireViewer();
  const today = todayIn(profile.timezone);
  const hour = hourIn(profile.timezone);
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [recent, older, capsules, mems14, journal14, msgs14, newLinks] = await Promise.all([
    supabase.from("memories").select("id,kind,title,created_at,occurred_on").order("created_at", { ascending: false }).limit(4),
    supabase
      .from("memories")
      .select("id,kind,title,body,occurred_on,created_at,source_type")
      .lt("created_at", monthAgo)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("capsules").select("id,title,open_at,sealed_at,opened_at").not("sealed_at", "is", null).is("opened_at", null).lte("open_at", new Date().toISOString()).returns<Capsule[]>(),
    supabase.from("memories").select("created_at").gte("created_at", since).limit(500),
    supabase.from("journal_entries").select("created_at").gte("created_at", since).limit(500),
    supabase.from("messages").select("created_at").eq("role", "user").gte("created_at", since).limit(1000),
    supabase.from("memory_links").select("id", { count: "exact", head: true }).eq("status", "approved").gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  // A Moment From Then
  const olderRows = (older.data ?? []) as Omit<MomentCandidate, "has_photo">[];
  let moment = null;
  if (olderRows.length) {
    const { data: photos } = await supabase
      .from("media")
      .select("memory_id")
      .eq("kind", "image")
      .in("memory_id", olderRows.map((m) => m.id).slice(0, 300));
    const withPhoto = new Set((photos ?? []).map((p) => p.memory_id));
    moment = pickMoment(
      olderRows.map((m) => ({ ...m, has_photo: withPhoto.has(m.id) })),
      today,
      profile.rediscovery_frequency,
      profile.rediscovery_kinds,
    );
  }

  const activity = buildActivity(today, [
    ...(mems14.data ?? []).map((r) => r.created_at as string),
    ...(journal14.data ?? []).map((r) => r.created_at as string),
    ...(msgs14.data ?? []).map((r) => r.created_at as string),
  ], profile.timezone);

  const name = profile.display_name?.trim();
  const prompt = promptForDate(today);
  const recentMemories = recent.data ?? [];

  return (
    <Page className="pt-6 sm:pt-12">
      <section className="rise mx-auto max-w-3xl text-center">
        <p className="eyebrow">{formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="display mt-5 text-[52px] leading-[0.98] sm:text-[84px]">
          {greetingFor(hour)}
          {name ? <span className="text-ink-soft">, {name}</span> : null}
          <span className="text-accent">.</span>
        </h1>
        <div className="mt-10 sm:mt-14">
          <AskField />
        </div>
      </section>

      {(capsules.data?.length ?? 0) > 0 && (
        <section className="mx-auto mt-10 max-w-3xl">
          {capsules.data!.map((c) => (
            <Link
              key={c.id}
              href={`/capsules/${c.id}`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4 transition-colors hover:border-accent/60"
            >
              <span className="flex items-center gap-3">
                <Hourglass size={18} className="text-accent" />
                <span>
                  <span className="block text-[15px] text-ink">A time capsule is ready to open</span>
                  <span className="block font-serif text-[14px] italic text-ink-soft">“{c.title}”</span>
                </span>
              </span>
              <ArrowUpRight size={18} className="text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </section>
      )}

      <div className="mt-16 grid gap-12 sm:mt-24 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow">Today’s question</p>
          <blockquote className="display mt-4 text-[30px] leading-[1.15] text-ink sm:text-[38px]">{prompt}</blockquote>
          <div className="mt-6 flex flex-wrap gap-4 text-[14px]">
            <Link href="/reflect/write?mode=daily_reset&prompt=today" className="text-accent underline-offset-4 hover:underline">
              Write about it
            </Link>
            <Link href="/reflect/write?mode=unfiltered" className="text-ink-faint underline-offset-4 hover:text-ink-soft hover:underline">
              Or write about anything
            </Link>
          </div>

          <div className="mt-14">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">The last two weeks</p>
              {(newLinks.count ?? 0) > 0 && (
                <Link href="/garden?view=constellation" className="text-[12px] text-accent-2 hover:underline">
                  {newLinks.count} new connection{newLinks.count === 1 ? "" : "s"} this week
                </Link>
              )}
            </div>
            <ActivityTrace days={activity} />
          </div>
        </section>

        <aside className="rise space-y-12" style={{ animationDelay: "220ms" }}>
          {moment ? (
            <section>
              <p className="eyebrow">A moment from then</p>
              <Link href={`/garden/${moment.memory.id}`} className="group mt-4 block">
                <p className="font-serif text-[14px] italic text-accent">{moment.reason}</p>
                <h2 className="display mt-2 text-[28px] leading-tight transition-colors group-hover:text-accent">{moment.memory.title}</h2>
                {moment.memory.body && (
                  <p className="mt-2 line-clamp-3 font-serif text-[16px] leading-relaxed text-ink-soft">{moment.memory.body}</p>
                )}
              </Link>
            </section>
          ) : profile.rediscovery_frequency !== "off" ? (
            <section>
              <p className="eyebrow">A moment from then</p>
              <p className="mt-4 font-serif text-[16px] leading-relaxed text-ink-faint">
                Once your memories are a month old, one of them will be waiting here now and then, like finding an old letter.
              </p>
            </section>
          ) : null}

          <section>
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Recently kept</p>
              <Link href="/garden" className="text-[12px] text-ink-faint hover:text-ink-soft">
                The garden →
              </Link>
            </div>
            {recentMemories.length ? (
              <ul className="mt-4 divide-y divide-line">
                {recentMemories.map((m) => (
                  <li key={m.id}>
                    <Link href={`/garden/${m.id}`} className="group flex items-baseline justify-between gap-4 py-3">
                      <span className="truncate text-[15px] text-ink transition-colors group-hover:text-accent">{m.title}</span>
                      <span className="shrink-0 text-[12px] text-ink-faint">
                        {MEMORY_KIND_LABELS[m.kind as MemoryKind]} · {relativeTime(m.created_at as string)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 font-serif text-[16px] leading-relaxed text-ink-faint">
                Nothing kept yet. Press <kbd className="text-ink-soft">⌘J</kbd> anywhere, or{" "}
                <Link href="/garden/new" className="text-accent hover:underline">
                  plant a first memory
                </Link>
                .
              </p>
            )}
          </section>
        </aside>
      </div>
    </Page>
  );
}

function buildActivity(today: string, timestamps: string[], timeZone: string) {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const d = todayIn(timeZone, new Date(ts));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const days: { date: string; count: number }[] = [];
  const base = Date.parse(`${today}T12:00:00Z`);
  for (let i = 13; i >= 0; i--) {
    const date = new Date(base - i * 86400000).toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}
