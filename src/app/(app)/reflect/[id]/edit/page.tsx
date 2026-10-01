import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { JOURNAL_COLUMNS, type JournalEntry } from "@/lib/types";
import { JournalEditor } from "@/components/reflect/JournalEditor";

export const metadata = { title: "Write" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireViewer();
  const { data: entry } = await supabase.from("journal_entries").select(JOURNAL_COLUMNS).eq("id", id).maybeSingle<JournalEntry>();
  if (!entry) notFound();
  const { data: revisit } = entry.revisits_id
    ? await supabase.from("journal_entries").select("id,title,body,created_at").eq("id", entry.revisits_id).maybeSingle()
    : { data: null };
  return (
    <JournalEditor
      mode={entry.mode}
      prompts={entry.prompt ? [entry.prompt] : []}
      revisit={revisit}
      initial={{ id: entry.id, title: entry.title, body: entry.body, mood: entry.mood }}
    />
  );
}
