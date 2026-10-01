"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { refreshMemoryEmbedding } from "@/lib/memory/embeddings";
import { journalInput, uuid } from "@/lib/validation";
import { MEMORY_COLUMNS, type JournalEntry, type Memory } from "@/lib/types";

/** Create or update an entry. Used by autosave, so it returns the id quietly. */
export async function saveEntry(
  id: string | null,
  input: { mode: string; title?: string | null; body: string; mood?: string | null; prompt?: string | null; revisits_id?: string | null; ai_access?: boolean },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { supabase, profile } = await requireViewer();
  const parsed = journalInput.safeParse({
    ...input,
    ai_access: input.ai_access ?? (input.mode === "unfiltered" ? false : profile.journal_ai_access),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  if (id) {
    if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown entry" };
    const { mode: _mode, revisits_id: _r, ...patch } = parsed.data;
    void _mode;
    void _r;
    const { error } = await supabase.from("journal_entries").update(patch).eq("id", id);
    if (error) return { ok: false, error: "Could not save" };
    revalidatePath(`/reflect/${id}`);
    revalidatePath("/reflect");
    return { ok: true, id };
  }
  if (!parsed.data.body.trim() && !parsed.data.title) return { ok: false, error: "Nothing to save yet" };
  const { data, error } = await supabase.from("journal_entries").insert(parsed.data).select("id").single();
  if (error || !data) return { ok: false, error: "Could not save" };
  revalidatePath("/reflect");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function setEntryAiAccess(id: string, aiAccess: boolean) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("journal_entries").update({ ai_access: aiAccess }).eq("id", id);
  revalidatePath(`/reflect/${id}`);
}

export async function deleteEntry(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const { data: media } = await supabase.from("media").select("storage_path").eq("journal_entry_id", id);
  if (media?.length) await supabase.storage.from("media").remove(media.map((m) => m.storage_path));
  await supabase.from("journal_entries").delete().eq("id", id);
  revalidatePath("/reflect");
  redirect("/reflect");
}

/** Keep an entry (or a passage the person selected) as a memory, with its source recorded. */
export async function entryToMemory(id: string, passage?: string) {
  const { supabase, profile } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false };
  const { data: entry } = await supabase.from("journal_entries").select("id,title,body,created_at,mode").eq("id", id).single<Pick<JournalEntry, "id" | "title" | "body" | "created_at" | "mode">>();
  if (!entry) return { ok: false };
  const text = (passage?.trim() || entry.body).slice(0, 20000);
  const first = text.split("\n")[0]!.replace(/[#*_>]/g, "").trim();
  const { data } = await supabase
    .from("memories")
    .insert({
      kind: "reflection",
      title: entry.title ?? (first.length > 80 ? `${first.slice(0, 77)}…` : first || "From my journal"),
      body: text,
      source_type: "journal",
      source_id: entry.id,
      source_excerpt: text.slice(0, 600),
      occurred_on: entry.created_at.slice(0, 10),
      ai_access: entry.mode === "unfiltered" ? false : profile.default_ai_access,
    })
    .select(MEMORY_COLUMNS)
    .single<Memory>();
  if (!data) return { ok: false };
  await refreshMemoryEmbedding(supabase, data);
  revalidatePath("/garden");
  return { ok: true, id: data.id };
}
