"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/data";
import { refreshMemoryEmbedding } from "@/lib/memory/embeddings";
import { MEMORY_COLUMNS, MEMORY_KINDS, type Memory, type MemoryProposal } from "@/lib/types";
import { parseTags, uuid } from "@/lib/validation";

const edits = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(20000).optional(),
    kind: z.enum(MEMORY_KINDS).optional(),
    tags: z.array(z.string()).optional(),
  })
  .optional();

function revalidateAll(conversationId?: string | null) {
  revalidatePath("/", "layout");
  revalidatePath("/memory");
  revalidatePath("/garden");
  if (conversationId) revalidatePath(`/talk/${conversationId}`);
}

/** Approve a suggestion, optionally with the person's own edits. */
export async function approveProposal(id: string, changes?: z.infer<typeof edits>) {
  const { supabase, profile } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown suggestion" };
  const parsedEdits = edits.safeParse(changes);
  if (!parsedEdits.success) return { ok: false, error: "Invalid changes" };
  const e = parsedEdits.data ?? {};

  const { data: p } = await supabase
    .from("memory_proposals")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle<MemoryProposal>();
  if (!p) return { ok: false, error: "This suggestion was already handled" };

  let memoryId: string | null = null;
  if (p.action === "create") {
    const { data, error } = await supabase
      .from("memories")
      .insert({
        kind: e.kind ?? p.kind ?? "reflection",
        title: e.title ?? p.title ?? "Untitled",
        body: e.body ?? p.body ?? "",
        tags: parseTags(e.tags ?? p.tags),
        source_type: p.source_type === "journal" ? "journal" : "conversation",
        source_id: p.source_id,
        source_excerpt: p.source_excerpt,
        ai_access: profile.default_ai_access,
        occurred_on: p.created_at.slice(0, 10),
      })
      .select(MEMORY_COLUMNS)
      .single<Memory>();
    if (error || !data) return { ok: false, error: "Could not save the memory" };
    memoryId = data.id;
    await refreshMemoryEmbedding(supabase, data);
  } else if (p.action === "update" && p.target_memory_id) {
    const patch: Record<string, string> = {};
    const title = e.title ?? p.title;
    const body = e.body ?? p.body;
    if (title) patch.title = title;
    if (body !== null && body !== undefined) patch.body = body;
    const { data, error } = await supabase
      .from("memories")
      .update(patch)
      .eq("id", p.target_memory_id)
      .select(MEMORY_COLUMNS)
      .single<Memory>();
    if (error || !data) return { ok: false, error: "Could not update the memory" };
    memoryId = data.id;
    await refreshMemoryEmbedding(supabase, data);
  } else if (p.action === "forget" && p.target_memory_id) {
    const { data: media } = await supabase.from("media").select("storage_path").eq("memory_id", p.target_memory_id);
    if (media?.length) await supabase.storage.from("media").remove(media.map((m) => m.storage_path));
    await supabase.from("memories").delete().eq("id", p.target_memory_id);
  }

  // A forgotten memory cascades its proposals away; only mark what remains.
  await supabase.from("memory_proposals").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", id);
  revalidateAll(p.source_id);
  return { ok: true, memoryId };
}

export async function dismissProposal(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false };
  const { data } = await supabase
    .from("memory_proposals")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("source_id")
    .maybeSingle();
  revalidateAll(data?.source_id);
  return { ok: true };
}
