"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { refreshMemoryEmbedding } from "@/lib/memory/embeddings";
import { memoryInput, parseTags, uuid } from "@/lib/validation";
import { MEMORY_COLUMNS, MEMORY_KINDS, type Memory, type MemoryKind, type Message } from "@/lib/types";

export type ActionState = { ok: boolean; error?: string; id?: string };

function readMemoryForm(form: FormData) {
  return memoryInput.safeParse({
    kind: form.get("kind") || undefined,
    title: form.get("title"),
    body: form.get("body") ?? "",
    occurred_on: form.get("occurred_on") ?? "",
    location: form.get("location") ?? "",
    category: form.get("category") ?? "",
    tags: parseTags(form.get("tags")),
    ai_access: form.get("ai_access") === "on" || form.get("ai_access") === "true",
  });
}

function revalidateMemories(id?: string) {
  revalidatePath("/");
  revalidatePath("/garden");
  revalidatePath("/memory");
  if (id) revalidatePath(`/garden/${id}`);
}

export async function createMemory(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  const parsed = readMemoryForm(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { data, error } = await supabase
    .from("memories")
    .insert({ ...parsed.data, source_type: "manual" })
    .select(MEMORY_COLUMNS)
    .single<Memory>();
  if (error || !data) return { ok: false, error: "That memory could not be saved. Please try again." };
  await refreshMemoryEmbedding(supabase, data);
  revalidateMemories();
  if (form.get("stay") === "1") return { ok: true, id: data.id };
  redirect(`/garden/${data.id}?saved=1`);
}

export async function updateMemory(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown memory" };
  const parsed = readMemoryForm(form);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { data, error } = await supabase
    .from("memories")
    .update(parsed.data)
    .eq("id", id)
    .select(MEMORY_COLUMNS)
    .single<Memory>();
  if (error || !data) return { ok: false, error: "Changes could not be saved." };
  await refreshMemoryEmbedding(supabase, data);
  revalidateMemories(id);
  return { ok: true, id };
}

export async function setMemoryFlags(id: string, flags: { ai_access?: boolean; pinned?: boolean }) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const patch: Record<string, boolean> = {};
  if (typeof flags.ai_access === "boolean") patch.ai_access = flags.ai_access;
  if (typeof flags.pinned === "boolean") patch.pinned = flags.pinned;
  await supabase.from("memories").update(patch).eq("id", id);
  revalidateMemories(id);
}

export async function deleteMemory(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const { data: media } = await supabase.from("media").select("storage_path").eq("memory_id", id);
  if (media?.length) await supabase.storage.from("media").remove(media.map((m) => m.storage_path));
  await supabase.from("memories").delete().eq("id", id);
  revalidateMemories();
  redirect("/garden?deleted=1");
}

export async function linkMemories(fromId: string, toId: string, note?: string): Promise<ActionState> {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(fromId).success || !uuid.safeParse(toId).success || fromId === toId) {
    return { ok: false, error: "Choose two different memories" };
  }
  const { error } = await supabase
    .from("memory_links")
    .insert({ from_id: fromId, to_id: toId, note: note?.slice(0, 500) || null, origin: "manual", status: "approved" });
  if (error) return { ok: false, error: error.code === "23505" ? "These are already connected" : "Could not connect them" };
  revalidateMemories(fromId);
  revalidatePath(`/garden/${toId}`);
  return { ok: true };
}

export async function unlinkMemories(linkId: string, memoryId: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(linkId).success) return;
  await supabase.from("memory_links").delete().eq("id", linkId);
  revalidateMemories(memoryId);
}

/** Save one chat message, verbatim, as a memory the user can then edit. */
export async function saveMessageAsMemory(messageId: string): Promise<ActionState> {
  const { supabase, profile } = await requireViewer();
  if (!uuid.safeParse(messageId).success) return { ok: false, error: "Unknown message" };
  const { data: msg } = await supabase
    .from("messages")
    .select("id,conversation_id,role,content,created_at")
    .eq("id", messageId)
    .single<Pick<Message, "id" | "conversation_id" | "role" | "content" | "created_at">>();
  if (!msg) return { ok: false, error: "Message not found" };
  const firstLine = msg.content.replace(/[#*_>`]/g, "").trim().split(/\n|(?<=[.!?])\s/)[0] ?? "";
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine || "Saved from a conversation";
  const { data, error } = await supabase
    .from("memories")
    .insert({
      kind: msg.role === "user" ? "reflection" : "idea",
      title,
      body: msg.content.slice(0, 20000),
      source_type: "conversation",
      source_id: msg.conversation_id,
      source_excerpt: msg.content.slice(0, 600),
      occurred_on: msg.created_at.slice(0, 10),
      ai_access: profile.default_ai_access,
    })
    .select(MEMORY_COLUMNS)
    .single<Memory>();
  if (error || !data) return { ok: false, error: "Could not save that message" };
  await refreshMemoryEmbedding(supabase, data);
  revalidateMemories();
  return { ok: true, id: data.id };
}

/** Quick capture from anywhere: a memory or a journal fragment, nothing more. */
export async function quickCapture(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, profile } = await requireViewer();
  const text = String(form.get("text") ?? "").trim();
  const as = form.get("as") === "journal" ? "journal" : "memory";
  if (!text) return { ok: false, error: "Write something first" };
  if (text.length > 20000) return { ok: false, error: "That is longer than a quick capture allows" };

  if (as === "journal") {
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ mode: "unfiltered", body: text, ai_access: profile.journal_ai_access })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Could not save" };
    revalidatePath("/reflect");
    return { ok: true, id: data.id };
  }

  const firstLine = text.split("\n")[0]!;
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine;
  const { data, error } = await supabase
    .from("memories")
    .insert({
      kind: MEMORY_KINDS.includes(form.get("kind") as MemoryKind) ? (form.get("kind") as MemoryKind) : "reflection",
      title,
      body: text === firstLine ? "" : text,
      tags: parseTags(form.get("tags")),
      source_type: "capture",
      ai_access: profile.default_ai_access,
      occurred_on: new Date().toISOString().slice(0, 10),
    })
    .select(MEMORY_COLUMNS)
    .single<Memory>();
  if (error || !data) return { ok: false, error: "Could not save" };
  await refreshMemoryEmbedding(supabase, data);
  revalidateMemories();
  return { ok: true, id: data.id };
}

export async function markSurfaced(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("memories").update({ last_surfaced_at: new Date().toISOString() }).eq("id", id);
}
