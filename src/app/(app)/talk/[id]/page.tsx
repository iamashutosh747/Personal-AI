import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { MESSAGE_COLUMNS, type Conversation, type MemoryProposal, type Message } from "@/lib/types";
import { ChatRoom, type ContextLabel } from "@/components/talk/ChatRoom";
import { aiConfigured } from "@/lib/ai/client";

export const metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireViewer();

  const { data: conversation } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle<Conversation>();
  if (!conversation) notFound();

  const [{ data: messages }, { data: proposals }, { data: memoryOptions }] = await Promise.all([
    supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at").returns<Message[]>(),
    supabase
      .from("memory_proposals")
      .select("*")
      .eq("source_id", id)
      .eq("source_type", "conversation")
      .eq("status", "pending")
      .order("created_at")
      .returns<MemoryProposal[]>(),
    supabase.from("memories").select("id,title,kind,ai_access").order("created_at", { ascending: false }).limit(500),
  ]);

  // Titles for every record that informed a reply, so the disclosure can name them.
  const memIds = new Set<string>();
  const entryIds = new Set<string>();
  const msgIds = new Set<string>();
  for (const m of messages ?? []) {
    m.context_memory_ids.forEach((x) => memIds.add(x));
    m.context_entry_ids.forEach((x) => entryIds.add(x));
    m.context_message_ids.forEach((x) => msgIds.add(x));
  }
  for (const p of proposals ?? []) if (p.target_memory_id) memIds.add(p.target_memory_id);

  const labels: Record<string, ContextLabel> = {};
  if (memIds.size) {
    const { data } = await supabase.from("memories").select("id,title").in("id", [...memIds]);
    for (const r of data ?? []) labels[r.id] = { title: r.title, source: "memory", href: `/garden/${r.id}` };
  }
  if (entryIds.size) {
    const { data } = await supabase.from("journal_entries").select("id,title,created_at").in("id", [...entryIds]);
    for (const r of data ?? []) labels[r.id] = { title: r.title ?? `Journal, ${r.created_at.slice(0, 10)}`, source: "journal", href: `/reflect/${r.id}` };
  }
  if (msgIds.size) {
    const { data } = await supabase.from("messages").select("id,conversation_id").in("id", [...msgIds]);
    const convIds = [...new Set((data ?? []).map((r) => r.conversation_id))];
    const { data: convs } = convIds.length ? await supabase.from("conversations").select("id,title").in("id", convIds) : { data: [] };
    const titles = new Map((convs ?? []).map((c) => [c.id, c.title]));
    for (const r of data ?? []) labels[r.id] = { title: `“${titles.get(r.conversation_id) ?? "A past conversation"}”`, source: "message", href: `/talk/${r.conversation_id}` };
  }

  return (
    <ChatRoom
      conversation={conversation}
      initialMessages={messages ?? []}
      initialProposals={(proposals ?? []).map((p) => ({ ...p, target_title: p.target_memory_id ? labels[p.target_memory_id]?.title : null }))}
      initialLabels={labels}
      memoryOptions={memoryOptions ?? []}
      aiReady={aiConfigured()}
    />
  );
}
