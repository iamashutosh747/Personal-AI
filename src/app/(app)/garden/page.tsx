import Link from "next/link";
import { Dices, Plus, Search } from "lucide-react";
import { requireViewer } from "@/lib/data";
import { MEMORY_KINDS, MEMORY_KIND_LABELS, type MemoryKind, type MemoryLink } from "@/lib/types";
import { formatDate, todayIn } from "@/lib/time";
import { Page, PageHeader } from "@/components/ui/Page";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";
import { Constellation } from "@/components/garden/Constellation";
import { cn } from "@/lib/cn";

export const metadata = { title: "Memory Garden" };

const VIEWS = [
  { id: "timeline", name: "Timeline" },
  { id: "archive", name: "Archive" },
  { id: "constellation", name: "Constellation" },
  { id: "calendar", name: "Calendar" },
] as const;

type Row = {
  id: string;
  kind: MemoryKind;
  title: string;
  body: string;
  occurred_on: string | null;
  created_at: string;
  tags: string[];
  location: string | null;
  ai_access: boolean;
  pinned: boolean;
};

export default async function GardenPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; kind?: string; tag?: string; month?: string; deleted?: string }>;
}) {
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.id === sp.view) ? sp.view! : "timeline";
  const { supabase, profile } = await requireViewer();

  let req = supabase
    .from("memories")
    .select("id,kind,title,body,occurred_on,created_at,tags,location,ai_access,pinned")
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  const q = (sp.q ?? "").trim().slice(0, 200);
  if (view === "archive") {
    if (q) req = req.textSearch("fts", q, { type: "websearch", config: "english" });
    if (sp.kind && (MEMORY_KINDS as readonly string[]).includes(sp.kind)) req = req.eq("kind", sp.kind);
    if (sp.tag) req = req.contains("tags", [sp.tag.toLowerCase()]);
  }
  const { data } = await req.returns<Row[]>();
  const memories = data ?? [];

  const { count: total } = await supabase.from("memories").select("id", { count: "exact", head: true });

  const ids = memories.map((m) => m.id);
  const { data: images } = ids.length
    ? await supabase.from("media").select("id,memory_id").eq("kind", "image").in("memory_id", ids.slice(0, 500)).order("created_at")
    : { data: [] };
  const cover = new Map<string, string>();
  for (const i of images ?? []) if (i.memory_id && !cover.has(i.memory_id)) cover.set(i.memory_id, i.id);

  return (
    <Page>
      <PageHeader
        eyebrow={`${total ?? 0} memories kept`}
        title="Memory Garden"
        actions={
          <>
            <Link href="/garden/random" className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] text-ink-soft hover:bg-raised hover:text-ink">
              <Dices size={16} /> Surprise me
            </Link>
            <Link href="/garden/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-ink hover:brightness-110">
              <Plus size={16} /> Plant a memory
            </Link>
          </>
        }
      >
        Not an endless feed: the things you chose to keep, and the threads between them.
      </PageHeader>

      {sp.deleted && <p className="mb-6 text-[13px] text-ink-faint">The memory was let go.</p>}

      <nav aria-label="Garden views" className="mb-10 flex gap-1 overflow-x-auto border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/garden?view=${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b px-4 py-3 text-[14px] transition-colors",
              view === v.id ? "border-accent text-ink" : "border-transparent text-ink-faint hover:text-ink-soft",
            )}
          >
            {v.name}
          </Link>
        ))}
      </nav>

      {total === 0 ? (
        <EmptyState
          title="An empty garden"
          action={
            <Link href="/garden/new" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-[14px] font-medium text-accent-ink">
              Plant the first memory
            </Link>
          }
        >
          Keep the things that matter: a day you don’t want to forget, a realization, a song, a person, a place, a photograph, a voice. Each
          one can be private or available to the AI, and you can connect them into constellations.
        </EmptyState>
      ) : view === "timeline" ? (
        <Timeline memories={memories} cover={cover} />
      ) : view === "archive" ? (
        <Archive memories={memories} cover={cover} q={q} kind={sp.kind} tag={sp.tag} />
      ) : view === "calendar" ? (
        <Calendar memories={memories} month={sp.month} today={todayIn(profile.timezone)} />
      ) : (
        <ConstellationView memories={memories} />
      )}
    </Page>
  );
}

function when(m: Row) {
  return m.occurred_on ?? m.created_at.slice(0, 10);
}

function Timeline({ memories, cover }: { memories: Row[]; cover: Map<string, string> }) {
  const byYear = new Map<string, Row[]>();
  for (const m of memories) {
    const y = when(m).slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), m]);
  }
  return (
    <div className="space-y-20">
      {[...byYear.entries()].map(([year, list]) => (
        <section key={year} className="grid gap-6 sm:grid-cols-[140px_1fr]">
          <h2 className="display text-[44px] leading-none text-ink-faint sm:sticky sm:top-24 sm:self-start">{year}</h2>
          <ol className="relative space-y-10 border-l border-line pl-8">
            {list.map((m) => (
              <li key={m.id} className="relative">
                <span className={cn("absolute -left-[37px] top-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg", m.pinned ? "bg-accent" : "bg-ink-faint")} />
                <Link href={`/garden/${m.id}`} className="group grid gap-5 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-[12px] text-ink-faint">
                      {formatDate(when(m), { day: "numeric", month: "long" })} · {MEMORY_KIND_LABELS[m.kind]}
                      {!m.ai_access && " · private"}
                    </p>
                    <h3 className="display mt-1 text-[28px] leading-tight transition-colors group-hover:text-accent">{m.title}</h3>
                    {m.body && <p className="mt-2 line-clamp-2 max-w-2xl font-serif text-[16px] leading-relaxed text-ink-soft">{m.body}</p>}
                  </div>
                  {cover.has(m.id) && (
                    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated media
                    <img src={`/api/media/${cover.get(m.id)}`} alt="" loading="lazy" className="h-28 w-40 rounded-xl border border-line object-cover" />
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Archive({ memories, cover, q, kind, tag }: { memories: Row[]; cover: Map<string, string>; q: string; kind?: string; tag?: string }) {
  return (
    <div>
      <form className="mb-8 grid gap-4 sm:grid-cols-[1fr_200px]" role="search">
        <input type="hidden" name="view" value="archive" />
        <div className="flex items-center gap-2 border-b border-line-strong focus-within:border-accent">
          <Search size={16} className="text-ink-faint" />
          <input name="q" defaultValue={q} placeholder="Search everything you’ve kept" aria-label="Search memories" className="field w-full bg-transparent py-2.5 text-[15px]" />
        </div>
        <select name="kind" defaultValue={kind ?? ""} aria-label="Kind" className="field border-b border-line-strong bg-transparent py-2.5 text-[14px] text-ink-soft [&>option]:bg-raised">
          <option value="">Every kind</option>
          {MEMORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {MEMORY_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {tag && <input type="hidden" name="tag" value={tag} />}
      </form>
      {tag && (
        <p className="mb-6 text-[13px] text-ink-faint">
          Tagged <Tag tone="accent">#{tag}</Tag>{" "}
          <Link href="/garden?view=archive" className="ml-2 hover:text-ink-soft">
            clear
          </Link>
        </p>
      )}
      {memories.length === 0 ? (
        <EmptyState title="Nothing found">Try fewer words, or a different kind.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((m) => (
            <li key={m.id}>
              <Link href={`/garden/${m.id}`} className="group block h-full rounded-2xl border border-line bg-raised/40 p-5 transition-colors hover:border-line-strong hover:bg-raised">
                {cover.has(m.id) && (
                  // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated media
                  <img src={`/api/media/${cover.get(m.id)}`} alt="" loading="lazy" className="mb-4 aspect-[16/10] w-full rounded-xl object-cover" />
                )}
                <p className="text-[11.5px] uppercase tracking-wider text-ink-faint">
                  {MEMORY_KIND_LABELS[m.kind]} · {formatDate(when(m), { month: "short", year: "numeric" })}
                </p>
                <h3 className="display mt-2 text-[23px] leading-tight group-hover:text-accent">{m.title}</h3>
                {m.body && <p className="mt-2 line-clamp-3 font-serif text-[15px] leading-relaxed text-ink-soft">{m.body}</p>}
                {m.tags.length > 0 && <p className="mt-3 truncate text-[12px] text-ink-faint">#{m.tags.join("  #")}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Calendar({ memories, month, today }: { memories: Row[]; month?: string; today: string }) {
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const [y, mo] = ym.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const byDay = new Map<string, Row[]>();
  for (const m of memories) {
    const d = when(m);
    if (d.startsWith(ym)) byDay.set(d, [...(byDay.get(d) ?? []), m]);
  }
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/garden?view=calendar&month=${prev}`} className="text-[14px] text-ink-faint hover:text-ink">
          ← {formatDate(`${prev}-01`, { month: "short" })}
        </Link>
        <h2 className="display text-[34px]">{formatDate(`${ym}-01`, { month: "long", year: "numeric" })}</h2>
        <Link href={`/garden?view=calendar&month=${next}`} className="text-[14px] text-ink-faint hover:text-ink">
          {formatDate(`${next}-01`, { month: "short" })} →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line text-[12px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-bg px-2 py-2 text-center text-ink-faint">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const list = d ? byDay.get(d) ?? [] : [];
          return (
            <div key={i} className={cn("min-h-[84px] bg-bg p-2 sm:min-h-[110px]", d === today && "bg-accent-soft")}>
              {d && (
                <>
                  <span className={cn("text-[12px]", list.length ? "text-ink" : "text-ink-faint")}>{Number(d.slice(8))}</span>
                  <ul className="mt-1 space-y-1">
                    {list.slice(0, 3).map((m) => (
                      <li key={m.id}>
                        <Link href={`/garden/${m.id}`} className="block truncate rounded px-1 text-[11.5px] text-accent hover:bg-accent-soft" title={m.title}>
                          {m.title}
                        </Link>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[11px] text-ink-faint">+{list.length - 3} more</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function ConstellationView({ memories }: { memories: Row[] }) {
  const { supabase } = await requireViewer();
  const { data: links } = await supabase.from("memory_links").select("*").neq("status", "rejected").returns<MemoryLink[]>();
  return (
    <Constellation
      nodes={memories.slice(0, 400).map((m) => ({ id: m.id, title: m.title, kind: m.kind, tags: m.tags, date: when(m), pinned: m.pinned }))}
      links={links ?? []}
    />
  );
}
