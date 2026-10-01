import Link from "next/link";
import { requireViewer } from "@/lib/data";
import { embeddingsEnabled } from "@/lib/memory/embeddings";
import { MEMORY_KIND_LABELS, type Memory, type MemoryProposal, type Observation } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { Page, PageHeader } from "@/components/ui/Page";
import { ProposalCard } from "@/components/memory/ProposalCard";
import { AiToggle } from "@/components/memory/AiToggle";
import { ObservationCard } from "@/components/reflect/ObservationCard";
import { cn } from "@/lib/cn";

export const metadata = { title: "Memory Ledger" };

const SOURCE_LABEL: Record<Memory["source_type"], string> = {
  manual: "Written by you",
  conversation: "From a conversation",
  journal: "From your journal",
  proposal: "Suggested, approved by you",
  import: "Imported at setup",
  capture: "Quick capture",
};

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "ai" } = await searchParams;
  const { supabase, profile } = await requireViewer();

  const [memories, proposals, observations, attributes, entries, recallable, privateCount, aiCount] = await Promise.all([
    supabase
      .from("memories")
      .select("id,kind,title,source_type,source_id,ai_access,pinned,created_at,tags")
      .eq("ai_access", show !== "private")
      .order("created_at", { ascending: false })
      .limit(300)
      .returns<Pick<Memory, "id" | "kind" | "title" | "source_type" | "source_id" | "ai_access" | "pinned" | "created_at" | "tags">[]>(),
    supabase.from("memory_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false }).returns<MemoryProposal[]>(),
    supabase.from("observations").select("*").order("created_at", { ascending: false }).limit(30).returns<Observation[]>(),
    supabase.from("self_attributes").select("id", { count: "exact", head: true }).is("until", null).eq("ai_access", true),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("ai_access", true).neq("mode", "unfiltered"),
    supabase.from("conversations").select("id,title").eq("ai_access", true).limit(50),
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("ai_access", false),
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("ai_access", true),
  ]);

  const targetIds = (proposals.data ?? []).map((p) => p.target_memory_id).filter(Boolean) as string[];
  const { data: targets } = targetIds.length ? await supabase.from("memories").select("id,title").in("id", targetIds) : { data: [] };
  const targetTitle = new Map((targets ?? []).map((t) => [t.id, t.title]));
  const blocked = profile.never_share_tags;

  return (
    <Page>
      <PageHeader eyebrow="Memory Ledger" title="Everything the AI can see">
        Nothing is remembered silently. This is the complete record of what Claude may draw on, where each piece came from, and what it has
        suggested. Change anything, at any time.
      </PageHeader>

      <section className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Stat n={aiCount.count ?? 0} label="Memories available to the AI" href="/memory?show=ai" />
        <Stat n={privateCount.count ?? 0} label="Memories kept private" href="/memory?show=private" />
        <Stat n={entries.count ?? 0} label="Journal entries the AI may recall" href="/reflect" />
        <Stat n={attributes.count ?? 0} label="Mirror attributes shared with the AI" href="/mirror" />
      </section>

      <section id="proposals" className="mt-16 scroll-mt-24">
        <h2 className="display text-[34px]">Waiting for you</h2>
        <p className="mt-2 text-[14px] text-ink-faint">Suggestions Claude made during conversations. None of them is a memory until you approve it.</p>
        {(proposals.data?.length ?? 0) === 0 ? (
          <p className="mt-6 font-serif text-[16px] text-ink-faint">Nothing waiting.</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {proposals.data!.map((p) => (
              <div key={p.id}>
                <ProposalCard proposal={{ ...p, target_title: p.target_memory_id ? targetTitle.get(p.target_memory_id) : null }} />
                {p.source_id && (
                  <Link href={`/talk/${p.source_id}`} className="mt-1.5 inline-block pl-1 text-[12px] text-ink-faint hover:text-ink-soft">
                    From this conversation →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[34px]">{show === "private" ? "Private memories" : "Memories the AI may use"}</h2>
          <nav className="flex gap-1 text-[13px]">
            {[
              ["ai", "Available to AI"],
              ["private", "Private"],
            ].map(([k, l]) => (
              <Link key={k} href={`/memory?show=${k}`} className={cn("rounded-full px-3 py-1.5", show === k ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink-soft")}>
                {l}
              </Link>
            ))}
          </nav>
        </div>
        {blocked.length > 0 && show !== "private" && (
          <p className="mt-2 text-[13px] text-ink-faint">
            Memories tagged {blocked.map((t) => `#${t}`).join(", ")} are never shared, even when marked available.
          </p>
        )}
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-raised/60 text-[11px] uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="w-1/2 px-4 py-3 font-normal sm:w-[42%]">Memory</th>
                <th className="hidden px-4 py-3 font-normal sm:table-cell">Kind</th>
                <th className="hidden px-4 py-3 font-normal md:table-cell">Source</th>
                <th className="hidden px-4 py-3 font-normal md:table-cell">Kept</th>
                <th className="px-4 py-3 text-right font-normal">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(memories.data ?? []).map((m) => {
                const neverShared = m.tags.some((t) => blocked.includes(t));
                return (
                  <tr key={m.id}>
                    <td className="max-w-0 px-4 py-3">
                      <Link href={`/garden/${m.id}`} className="block truncate hover:text-accent">
                        {m.title}
                      </Link>
                      {neverShared && <span className="text-[11px] text-ink-faint">has a never-share tag</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-faint sm:table-cell">{MEMORY_KIND_LABELS[m.kind]}</td>
                    <td className="hidden px-4 py-3 text-ink-faint md:table-cell">
                      {m.source_type === "conversation" && m.source_id ? (
                        <Link href={`/talk/${m.source_id}`} className="hover:text-ink-soft">
                          {SOURCE_LABEL[m.source_type]}
                        </Link>
                      ) : m.source_type === "journal" && m.source_id ? (
                        <Link href={`/reflect/${m.source_id}`} className="hover:text-ink-soft">
                          {SOURCE_LABEL[m.source_type]}
                        </Link>
                      ) : (
                        SOURCE_LABEL[m.source_type]
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-ink-faint md:table-cell">{formatDate(m.created_at, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3 text-right">
                      <AiToggle id={m.id} initial={m.ai_access} label={m.title} />
                    </td>
                  </tr>
                );
              })}
              {(memories.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center font-serif text-ink-faint">
                    {show === "private" ? "No private memories." : "The AI can’t see any memories yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="display text-[30px]">Conversations it may recall</h2>
          <p className="mt-2 text-[14px] text-ink-faint">Off by default for every conversation. Turn it on from a conversation’s memory settings.</p>
          <ul className="mt-4 space-y-1.5 text-[14px]">
            {(recallable.data ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/talk/${c.id}`} className="text-ink-soft hover:text-accent">
                  {c.title}
                </Link>
              </li>
            ))}
            {(recallable.data?.length ?? 0) === 0 && <li className="font-serif text-ink-faint">None.</li>}
          </ul>
        </div>
        <div>
          <h2 className="display text-[30px]">Temporary context</h2>
          <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink-soft">
            Conversations marked <em>off the record</em> are never written to the database. They exist only in your browser tab and in the single
            request sent to Claude while you talk, then they’re gone.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="display text-[34px]">AI observations</h2>
        <p className="mt-2 text-[14px] text-ink-faint">Patterns, summaries and questions the AI produced at your request. Each one cites what it rests on.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {(observations.data ?? []).map((o) => (
            <ObservationCard key={o.id} observation={o} />
          ))}
          {(observations.data?.length ?? 0) === 0 && <p className="font-serif text-[16px] text-ink-faint">None yet.</p>}
        </div>
      </section>

      <section className="mt-16 rounded-3xl border border-line p-6 sm:p-8">
        <h2 className="display text-[30px]">Where your words go</h2>
        <ul className="mt-4 space-y-3 font-serif text-[16px] leading-relaxed text-ink-soft">
          <li>Everything you keep is stored in your own Supabase project, protected so that only your account can read it.</li>
          <li>
            When you talk with Claude, your message, the recent conversation and the records listed under each reply are sent to Anthropic’s API
            to generate a response. Anthropic does not train on API data by default.
          </li>
          <li>
            {embeddingsEnabled()
              ? "Semantic search is on: memory text is sent to Voyage AI to create search vectors."
              : "Search runs entirely inside your database. No third-party search service is used."}
          </li>
          <li>No advertising, no analytics, no tracking.</li>
        </ul>
        <Link href="/settings#data" className="mt-6 inline-block text-[14px] text-accent hover:underline">
          Export or delete everything →
        </Link>
      </section>
    </Page>
  );
}

function Stat({ n, label, href }: { n: number; label: string; href: string }) {
  return (
    <Link href={href} className="block bg-bg p-6 transition-colors hover:bg-raised">
      <p className="display text-[44px] leading-none">{n}</p>
      <p className="mt-2 text-[13px] text-ink-faint">{label}</p>
    </Link>
  );
}
