import Link from "next/link";
import { Search } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { JOURNAL_COLUMNS, JOURNAL_MODES, JOURNAL_MODE_LABELS, type JournalEntry, type Observation } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { Page, PageHeader } from "@/components/ui/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { ObservationCard } from "@/components/reflect/ObservationCard";
import { SummaryControls } from "@/components/reflect/SummaryControls";

export const metadata = { title: "Reflection Room" };

export default async function ReflectPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 200);
  const { supabase } = await requireViewer();

  let req = supabase.from("journal_entries").select(JOURNAL_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (query) req = req.textSearch("fts", query, { type: "websearch", config: "english" });
  const [{ data: entries }, { data: reflections }] = await Promise.all([
    req.returns<JournalEntry[]>(),
    supabase.from("observations").select("*").in("scope", ["weekly", "monthly"]).order("created_at", { ascending: false }).limit(12).returns<Observation[]>(),
  ]);
  const list = entries ?? [];

  return (
    <Page>
      <PageHeader eyebrow="Reflection Room" title="A quiet place to write">
        Your entries are kept exactly as you wrote them. AI help is optional, always labelled, and never touches the original.
      </PageHeader>

      <section aria-label="Ways to write" className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {JOURNAL_MODES.map((m) => (
          <Link key={m} href={`/reflect/write?mode=${m}`} className="group bg-bg p-6 transition-colors hover:bg-raised">
            <h2 className="display text-[28px] transition-colors group-hover:text-accent">{JOURNAL_MODE_LABELS[m].name}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-faint">{JOURNAL_MODE_LABELS[m].note}</p>
          </Link>
        ))}
      </section>

      <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="eyebrow">Your journal</h2>
            <form role="search" className="flex w-full max-w-xs items-center gap-2 border-b border-line-strong focus-within:border-accent">
              <Search size={15} className="text-ink-faint" />
              <input name="q" defaultValue={query} placeholder="Search entries" aria-label="Search entries" className="field w-full bg-transparent py-2 text-[14px]" />
            </form>
          </div>
          {list.length === 0 ? (
            query ? (
              <EmptyState title="Nothing found">No entry mentions “{query}”.</EmptyState>
            ) : (
              <EmptyState title="The page is waiting">
                Choose a way in above. A Daily Reset takes three minutes; Unfiltered has no prompts and no AI at all.
              </EmptyState>
            )
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {list.map((e) => (
                <li key={e.id}>
                  <Link href={`/reflect/${e.id}`} className="group block py-5">
                    <p className="text-[12px] text-ink-faint">
                      {formatDate(e.created_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {JOURNAL_MODE_LABELS[e.mode].name}
                      {e.mood ? ` · ${e.mood}` : ""}
                    </p>
                    {e.title && <h3 className="display mt-1 text-[24px] leading-tight group-hover:text-accent">{e.title}</h3>}
                    <p className="mt-1 line-clamp-2 font-serif text-[16px] leading-relaxed text-ink-soft">{e.body || "…"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <h2 className="eyebrow">Reflections</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-faint">
            Ask the AI to read back over a week or a month. Every point it makes is labelled and links to the entries behind it; you decide
            whether it rings true.
          </p>
          <SummaryControls />
          <div className="mt-8 space-y-4">
            {(reflections ?? []).map((o) => (
              <ObservationCard key={o.id} observation={o} />
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}
