import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { MEMORY_COLUMNS, type Media, type Memory, type MemoryLink } from "@/lib/types";
import { Page } from "@/components/ui/Page";
import { MemoryDetail } from "@/components/garden/MemoryDetail";

export const metadata = { title: "Memory" };

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; found?: string }>;
}) {
  const { id } = await params;
  const { saved, found } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireViewer();

  const { data: memory } = await supabase.from("memories").select(MEMORY_COLUMNS).eq("id", id).maybeSingle<Memory>();
  if (!memory) notFound();

  const [{ data: media }, { data: links }, { data: others }] = await Promise.all([
    supabase.from("media").select("*").eq("memory_id", id).order("created_at").returns<Media[]>(),
    supabase.from("memory_links").select("*").or(`from_id.eq.${id},to_id.eq.${id}`).neq("status", "rejected").returns<MemoryLink[]>(),
    supabase.from("memories").select("id,title,kind,occurred_on,created_at").neq("id", id).order("created_at", { ascending: false }).limit(500),
  ]);

  const titleOf = new Map((others ?? []).map((o) => [o.id, o.title]));
  const connected = (links ?? []).map((l) => {
    const other = l.from_id === id ? l.to_id : l.from_id;
    return { link: l, other: { id: other, title: titleOf.get(other) ?? "A memory" } };
  });

  let source: { label: string; href?: string } | null = null;
  if (memory.source_type === "conversation" && memory.source_id) {
    const { data: c } = await supabase.from("conversations").select("id,title").eq("id", memory.source_id).maybeSingle();
    source = c ? { label: `Saved from the conversation “${c.title}”`, href: `/talk/${c.id}` } : { label: "Saved from a conversation you have since deleted" };
  } else if (memory.source_type === "journal" && memory.source_id) {
    source = { label: "Saved from a journal entry", href: `/reflect/${memory.source_id}` };
  } else if (memory.source_type === "import") {
    source = { label: "Imported during setup" };
  } else if (memory.source_type === "capture") {
    source = { label: "Quick capture" };
  } else {
    source = { label: "Written by you" };
  }

  // Shared tags suggest relationships but never claim one: shown as hints only.
  const tagSiblings = memory.tags.length
    ? (
        await supabase
          .from("memories")
          .select("id,title,tags")
          .neq("id", id)
          .overlaps("tags", memory.tags)
          .limit(6)
      ).data ?? []
    : [];

  return (
    <Page narrow>
      <MemoryDetail
        memory={memory}
        media={media ?? []}
        connected={connected}
        tagSiblings={tagSiblings.filter((t) => !connected.some((c) => c.other.id === t.id))}
        others={(others ?? []).map((o) => ({ id: o.id, title: o.title }))}
        source={source}
        justSaved={saved === "1"}
        discovered={found === "1"}
        defaultAiAccess={profile.default_ai_access}
      />
    </Page>
  );
}
