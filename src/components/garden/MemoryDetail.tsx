"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Link2, Lock, MapPin, Pencil, Pin, Sparkles, Trash2, Unlink } from "lucide-react";
import { deleteMemory, linkMemories, setMemoryFlags, unlinkMemories } from "@/lib/actions/memories";
import { MEMORY_KIND_LABELS, type Media, type Memory, type MemoryLink } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Markdown } from "@/components/ui/Markdown";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { MediaGallery, PhotoPicker, VoiceRecorder, uploadMedia, type MediaItem } from "./MediaTools";
import { MemoryForm } from "./MemoryForm";

export function MemoryDetail({
  memory,
  media,
  connected,
  tagSiblings,
  others,
  source,
  justSaved,
  discovered,
  defaultAiAccess,
}: {
  memory: Memory;
  media: Media[];
  connected: { link: MemoryLink; other: { id: string; title: string } }[];
  tagSiblings: { id: string; title: string; tags: string[] }[];
  others: { id: string; title: string }[];
  source: { label: string; href?: string } | null;
  justSaved: boolean;
  discovered: boolean;
  defaultAiAccess: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<MediaItem[]>(media);
  const [linking, setLinking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justLinked, setJustLinked] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const candidates = useMemo(
    () => others.filter((o) => !connected.some((c) => c.other.id === o.id) && o.title.toLowerCase().includes(filter.toLowerCase())).slice(0, 40),
    [others, connected, filter],
  );

  async function addFiles(files: File[]) {
    setError(null);
    for (const f of files) {
      const r = await uploadMedia(f, { memoryId: memory.id });
      if (r.media) setItems((prev) => [...prev, r.media!]);
      else setError(r.error ?? "Upload failed");
    }
  }

  async function removeMedia(id: string) {
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((m) => m.id !== id));
  }

  if (editing) {
    return (
      <div className="pt-8 sm:pt-14">
        <p className="eyebrow mb-8">Editing</p>
        <MemoryForm memory={memory} defaultAiAccess={defaultAiAccess} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const date = memory.occurred_on ?? memory.created_at;

  return (
    <article className="pt-6 sm:pt-12">
      <Link href="/garden" className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft">
        <ArrowLeft size={14} /> Memory Garden
      </Link>

      {(justSaved || discovered) && (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          className="mt-6 flex w-fit items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-[13px] text-accent"
        >
          <Sparkles size={14} /> {justSaved ? "Planted. It will be here whenever you return." : "Found, somewhere in your garden."}
        </motion.p>
      )}

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-faint">
          <span className="eyebrow !text-accent">{MEMORY_KIND_LABELS[memory.kind]}</span>
          <span>{formatDate(date)}</span>
          {memory.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {memory.location}
            </span>
          )}
          {memory.category && <span>· {memory.category}</span>}
        </div>
        <h1 className="display mt-4 text-[44px] leading-[1.02] sm:text-[60px]">{memory.title}</h1>
      </header>

      {memory.body && (
        <div className="mt-8 text-[18px]">
          <Markdown>{memory.body}</Markdown>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-10">
          <MediaGallery items={items} onRemove={removeMedia} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <PhotoPicker onFiles={addFiles} />
        <VoiceRecorder onRecorded={(f) => addFiles([f])} />
      </div>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

      {memory.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {memory.tags.map((t) => (
            <Link key={t} href={`/garden?view=archive&tag=${encodeURIComponent(t)}`}>
              <Tag>#{t}</Tag>
            </Link>
          ))}
        </div>
      )}

      {/* Controls */}
      <section className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        <FlagButton
          active={memory.ai_access}
          onClick={() => start(async () => { await setMemoryFlags(memory.id, { ai_access: !memory.ai_access }); router.refresh(); })}
          icon={<Lock size={15} />}
          label={memory.ai_access ? "Available to the AI" : "Private from the AI"}
          note={memory.ai_access ? "Claude may draw on this. Tap to make it private." : "Only you can see this. Tap to allow the AI."}
        />
        <FlagButton
          active={memory.pinned}
          onClick={() => start(async () => { await setMemoryFlags(memory.id, { pinned: !memory.pinned }); router.refresh(); })}
          icon={<Pin size={15} />}
          label={memory.pinned ? "Pinned" : "Not pinned"}
          note={memory.pinned ? "Prioritised when the AI searches your memories." : "Pin to make it more likely to be recalled."}
        />
      </section>

      {/* Connections */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Connected memories</h2>
          <button onClick={() => setLinking(true)} className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
            <Link2 size={14} /> Connect another
          </button>
        </div>
        {connected.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {connected.map(({ link, other }) => (
              <motion.li
                key={link.id}
                initial={justLinked === other.id ? { backgroundColor: "rgba(217,163,91,0.18)" } : false}
                animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                transition={{ duration: 1.6 }}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <Link href={`/garden/${other.id}`} className="block truncate text-[15px] hover:text-accent">
                    {other.title}
                  </Link>
                  {link.note && <span className="block text-[12.5px] italic text-ink-faint">{link.note}</span>}
                  {link.origin === "ai_suggested" && <span className="text-[11px] text-accent-2">suggested by AI, approved by you</span>}
                </span>
                <button
                  onClick={() => start(() => unlinkMemories(link.id, memory.id))}
                  aria-label={`Disconnect from ${other.title}`}
                  className="rounded-full p-2 text-ink-faint hover:text-danger"
                >
                  <Unlink size={14} />
                </button>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-serif text-[15px] text-ink-faint">Not connected to anything yet. Connections appear as lines in the constellation.</p>
        )}
        {tagSiblings.length > 0 && (
          <p className="mt-4 text-[13px] text-ink-faint">
            Shares a tag with:{" "}
            {tagSiblings.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                <Link href={`/garden/${t.id}`} className="text-ink-soft hover:text-accent">
                  {t.title}
                </Link>
              </span>
            ))}
          </p>
        )}
      </section>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-ink-faint">
        <span>
          {source?.href ? (
            <Link href={source.href} className="hover:text-ink-soft">
              {source.label}
            </Link>
          ) : (
            source?.label
          )}{" "}
          · kept {formatDate(memory.created_at)}
          {memory.updated_at !== memory.created_at && ` · edited ${formatDate(memory.updated_at)}`}
        </span>
        <span className="flex gap-2">
          <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} /> Delete
          </Button>
        </span>
      </footer>

      <Modal open={linking} onClose={() => setLinking(false)} title="Connect a memory">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a memory"
          aria-label="Find a memory"
          autoFocus
          className="field w-full border-b border-line-strong bg-transparent py-2 text-[15px] focus:border-accent"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How are they connected? (optional)"
          aria-label="Connection note"
          maxLength={500}
          className="field mt-3 w-full border-b border-line bg-transparent py-2 text-[14px] focus:border-accent"
        />
        <ul className="mt-3 max-h-72 overflow-y-auto">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await linkMemories(memory.id, c.id, note);
                    if (r.ok) {
                      setJustLinked(c.id);
                      setLinking(false);
                      setNote("");
                      router.refresh();
                    } else setError(r.error ?? null);
                  })
                }
                className="block w-full truncate rounded-lg px-2 py-2.5 text-left text-[14px] hover:bg-sunken hover:text-accent"
              >
                {c.title}
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className="py-6 text-center text-[13px] text-ink-faint">Nothing to connect.</li>}
        </ul>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Let this memory go?">
        <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
          It will be deleted permanently, with its photographs, recordings and connections. The AI will no longer be able to recall it.
        </p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => start(() => deleteMemory(memory.id))}>
            Delete permanently
          </Button>
        </div>
      </Modal>
    </article>
  );
}

function FlagButton({ active, onClick, icon, label, note }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; note: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} className="flex items-start gap-3 bg-bg p-5 text-left transition-colors hover:bg-raised">
      <span className={cn("mt-0.5", active ? "text-accent" : "text-ink-faint")}>{icon}</span>
      <span>
        <span className="block text-[14.5px] text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-faint">{note}</span>
      </span>
    </button>
  );
}
