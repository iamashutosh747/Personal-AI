import Link from "next/link";
import { Archive, EyeOff, Search } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { startConversation } from "@/lib/actions/conversations";
import { relativeTime } from "@/lib/time";
import type { Conversation } from "@/lib/types";
import { Page, PageHeader } from "@/components/ui/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Conversations" };

export default async function TalkPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const { supabase } = await requireViewer();
  const { q = "", archived } = await searchParams;
  const showArchived = archived === "1";
  const query = q.trim().slice(0, 200);

  let ids: string[] | null = null;
  if (query) {
    const [byTitle, byText] = await Promise.all([
      supabase.from("conversations").select("id").ilike("title", `%${query.replace(/[%_]/g, "")}%`).limit(100),
      supabase.from("messages").select("conversation_id").textSearch("fts", query, { type: "websearch", config: "english" }).limit(300),
    ]);
    ids = [...new Set([...(byTitle.data ?? []).map((r) => r.id), ...(byText.data ?? []).map((r) => r.conversation_id)])];
  }

  let req = supabase.from("conversations").select("*").eq("archived", showArchived).order("last_message_at", { ascending: false }).limit(200);
  if (ids) req = req.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await req.returns<Conversation[]>();
  const conversations = data ?? [];

  return (
    <Page narrow>
      <PageHeader
        eyebrow="Conversation space"
        title="Conversations"
        actions={
          <>
            <Link href="/talk/off-record" className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] text-ink-soft hover:bg-raised hover:text-ink">
              <EyeOff size={16} /> Off the record
            </Link>
            <form action={startConversation}>
              <Button variant="primary" type="submit">
                New conversation
              </Button>
            </form>
          </>
        }
      >
        Every thread stays here, in your words and Claude’s, exactly as it happened.
      </PageHeader>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <form className="flex flex-1 items-center gap-2 border-b border-line-strong focus-within:border-accent" role="search">
          <Search size={16} className="text-ink-faint" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="field w-full bg-transparent py-2.5 text-[15px] placeholder:text-ink-faint"
          />
          {showArchived && <input type="hidden" name="archived" value="1" />}
        </form>
        <Link
          href={showArchived ? "/talk" : "/talk?archived=1"}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft"
        >
          <Archive size={14} /> {showArchived ? "Back to current" : "Archived"}
        </Link>
      </div>

      {conversations.length === 0 ? (
        query ? (
          <EmptyState title="Nothing found">No conversation mentions “{query}”.</EmptyState>
        ) : showArchived ? (
          <EmptyState title="Nothing archived">Archived conversations rest here, out of the way but never lost.</EmptyState>
        ) : (
          <EmptyState title="No conversations yet">
            Say anything: a passing thought, a decision you’re turning over, a question with no answer. Claude can draw on the memories you’ve
            allowed, and you can see exactly which ones.
          </EmptyState>
        )
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/talk/${c.id}`} className="group flex items-baseline justify-between gap-6 py-5">
                <span className="min-w-0">
                  <span className="block truncate font-display text-[23px] leading-tight transition-colors group-hover:text-accent">{c.title}</span>
                  <span className="mt-1 block text-[12px] text-ink-faint">
                    {c.memory_mode === "none" ? "Memory off" : c.memory_mode === "chosen" ? "Chosen memories only" : "Memory on"}
                    {c.journal_entry_id ? " · in your journal" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-ink-faint">{relativeTime(c.last_message_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
