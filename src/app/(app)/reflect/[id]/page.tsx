import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { JOURNAL_COLUMNS, JOURNAL_MODE_LABELS, type JournalEntry, type Observation } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { Page } from "@/components/ui/Page";
import { Markdown } from "@/components/ui/Markdown";
import { ObservationCard } from "@/components/reflect/ObservationCard";
import { EntryActions } from "@/components/reflect/EntryActions";

export const metadata = { title: "Journal entry" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireViewer();
  const { data: entry } = await supabase.from("journal_entries").select(JOURNAL_COLUMNS).eq("id", id).maybeSingle<JournalEntry>();
  if (!entry) notFound();

  const [{ data: observations }, { data: revisits }, { data: original }] = await Promise.all([
    supabase.from("observations").select("*").eq("entry_id", id).order("created_at").returns<Observation[]>(),
    supabase.from("journal_entries").select("id,created_at").eq("revisits_id", id).order("created_at"),
    entry.revisits_id
      ? supabase.from("journal_entries").select("id,title,created_at").eq("id", entry.revisits_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <Page narrow>
      <article className="pt-6 sm:pt-12">
        <Link href="/reflect" className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft">
          <ArrowLeft size={14} /> Reflection Room
        </Link>
        <p className="mt-8 text-[13px] text-ink-faint">
          <span className="eyebrow !text-accent">{JOURNAL_MODE_LABELS[entry.mode].name}</span>
          <span className="ml-3">{formatDate(entry.created_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          {entry.mood && <span> · feeling {entry.mood}</span>}
        </p>
        {original && (
          <p className="mt-2 text-[13px] text-ink-faint">
            Looking back at{" "}
            <Link href={`/reflect/${original.id}`} className="text-ink-soft hover:text-accent">
              {original.title ?? `your entry from ${formatDate(original.created_at)}`}
            </Link>
          </p>
        )}
        {entry.prompt && <p className="mt-6 font-display text-[22px] italic text-ink-soft">{entry.prompt}</p>}
        {entry.title && <h1 className="display mt-4 text-[44px] leading-tight sm:text-[54px]">{entry.title}</h1>}
        <div className="mt-8 text-[18px]">
          <Markdown preserveBreaks>{entry.body || "_(empty)_"}</Markdown>
        </div>
        {entry.updated_at !== entry.created_at && (
          <p className="mt-6 text-[12px] text-ink-faint">Edited by you {formatDate(entry.updated_at)}</p>
        )}
        {revisits && revisits.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-faint">
            You returned to this{" "}
            {revisits.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ", "}
                <Link href={`/reflect/${r.id}`} className="text-ink-soft hover:text-accent">
                  on {formatDate(r.created_at)}
                </Link>
              </span>
            ))}
            .
          </p>
        )}

        <EntryActions entry={entry} />

        {(observations?.length ?? 0) > 0 && (
          <section className="mt-12">
            <h2 className="eyebrow">The AI layer</h2>
            <p className="mt-2 text-[12.5px] text-ink-faint">Separate from your entry, which is never changed.</p>
            <div className="mt-4 space-y-3">
              {observations!.map((o) => (
                <ObservationCard key={o.id} observation={o} />
              ))}
            </div>
          </section>
        )}
      </article>
    </Page>
  );
}
