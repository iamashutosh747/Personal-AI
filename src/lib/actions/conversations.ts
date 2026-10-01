"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/data";
import { uuid } from "@/lib/validation";
import type { Message } from "@/lib/types";

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || "Untitled conversation";
}

/**
 * Start a thread with its first message already stored. The conversation page
 * notices the unanswered message and asks Claude to reply, so nothing personal
 * ever travels in a URL.
 */
export async function startConversation(form: FormData) {
  const { supabase } = await requireViewer();
  const text = String(form.get("text") ?? "").trim().slice(0, 20000);
  const offRecord = form.get("off_record") === "1";
  if (offRecord) redirect("/talk/off-record");

  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ title: text ? titleFrom(text) : "Untitled conversation" })
    .select("id")
    .single();
  if (error || !convo) throw new Error("Could not start a conversation");
  if (text) {
    await supabase.from("messages").insert({ conversation_id: convo.id, role: "user", content: text });
  }
  revalidatePath("/talk");
  redirect(`/talk/${convo.id}`);
}

export async function renameConversation(id: string, title: string) {
  const { supabase } = await requireViewer();
  const clean = title.trim().slice(0, 200);
  if (!uuid.safeParse(id).success || !clean) return;
  await supabase.from("conversations").update({ title: clean }).eq("id", id);
  revalidatePath("/talk");
  revalidatePath(`/talk/${id}`);
}

export async function setConversationArchived(id: string, archived: boolean) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("conversations").update({ archived }).eq("id", id);
  revalidatePath("/talk");
  revalidatePath(`/talk/${id}`);
}

export async function deleteConversation(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("conversations").delete().eq("id", id);
  revalidatePath("/talk");
  redirect("/talk");
}

const memorySettings = z.object({
  memory_mode: z.enum(["all", "chosen", "none"]),
  chosen_memory_ids: z.array(z.string().uuid()).max(50),
  ai_access: z.boolean(),
});

export async function updateConversationMemory(id: string, settings: z.infer<typeof memorySettings>) {
  const { supabase } = await requireViewer();
  const parsed = memorySettings.safeParse(settings);
  if (!uuid.safeParse(id).success || !parsed.success) return { ok: false };
  await supabase.from("conversations").update(parsed.data).eq("id", id);
  revalidatePath(`/talk/${id}`);
  return { ok: true };
}

/**
 * Turn a conversation into a journal entry. The transcript is copied verbatim
 * and each speaker is labelled, so the record stays honest about who said what.
 */
export async function conversationToJournal(id: string) {
  const { supabase, profile } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const { data: convo } = await supabase.from("conversations").select("id,title").eq("id", id).single();
  const { data: messages } = await supabase
    .from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", id)
    .order("created_at")
    .returns<Pick<Message, "role" | "content" | "created_at">[]>();
  if (!convo || !messages?.length) return;
  const name = profile.display_name || "Me";
  const body = messages
    .map((m) => `**${m.role === "user" ? name : "Claude (AI)"}**\n\n${m.content}`)
    .join("\n\n---\n\n");
  const { data: entry } = await supabase
    .from("journal_entries")
    .insert({ mode: "deep", title: convo.title, body, ai_access: profile.journal_ai_access })
    .select("id")
    .single();
  if (!entry) return;
  await supabase.from("conversations").update({ journal_entry_id: entry.id }).eq("id", id);
  revalidatePath("/reflect");
  redirect(`/reflect/${entry.id}`);
}

/** Open a conversation about a journal entry. The entry text is quoted in your first message, visibly. */
export async function discussEntry(entryId: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(entryId).success) return;
  const { data: entry } = await supabase.from("journal_entries").select("id,title,body,mode").eq("id", entryId).single();
  if (!entry || entry.mode === "unfiltered") return;
  const quoted = entry.body.slice(0, 12000).split("\n").map((l: string) => `> ${l}`).join("\n");
  const { data: convo } = await supabase
    .from("conversations")
    .insert({ title: `Thinking through: ${titleFrom(entry.title ?? entry.body).slice(0, 150)}`, journal_entry_id: entry.id })
    .select("id")
    .single();
  if (!convo) return;
  await supabase.from("messages").insert({
    conversation_id: convo.id,
    role: "user",
    content: `I'd like to think through something I wrote in my journal:\n\n${quoted}`,
  });
  revalidatePath("/talk");
  redirect(`/talk/${convo.id}`);
}
