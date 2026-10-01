"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Lock, MessageCircle, Pencil, Sparkles, Trash2 } from "lucide-react";
import { deleteEntry, entryToMemory, setEntryAiAccess } from "@/lib/actions/journal";
import { discussEntry } from "@/lib/actions/conversations";
import type { JournalEntry } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function EntryActions({ entry }: { entry: JournalEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [kept, setKept] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const unfiltered = entry.mode === "unfiltered";

  async function askQuestions() {
    setAsking(true);
    setNote(null);
    const res = await fetch("/api/reflect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "questions", entryId: entry.id }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setAsking(false);
    if (!res.ok) setNote(json.error ?? "Something went wrong.");
    else router.refresh();
  }

  const chip = "inline-flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40";

  return (
    <div className="mt-12 border-t border-line pt-6">
      <div className="flex flex-wrap gap-2">
        <Link href={`/reflect/${entry.id}/edit`} className={chip}>
          <Pencil size={14} /> Edit
        </Link>
        {!unfiltered && (
          <>
            <button onClick={askQuestions} disabled={asking} className={`${chip} !border-dashed !border-accent-2/50 !text-accent-2`}>
              <Sparkles size={14} /> {asking ? "Reading…" : "Ask me a few questions"}
            </button>
            <button onClick={() => start(() => discussEntry(entry.id))} disabled={pending} className={chip}>
              <MessageCircle size={14} /> Think it through with Claude
            </button>
          </>
        )}
        {kept ? (
          <Link href={`/garden/${kept}`} className={`${chip} !text-ok`}>
            Kept in the garden
          </Link>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const passage = window.getSelection()?.toString();
                const r = await entryToMemory(entry.id, passage);
                if (r.ok && r.id) setKept(r.id);
              })
            }
            className={chip}
            title="Select a passage first to keep just that part"
          >
            <Bookmark size={14} /> Keep as memory
          </button>
        )}
      </div>
      {note && <p className="mt-3 text-[13px] text-ink-soft">{note}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-[12.5px] text-ink-faint">
        <button
          onClick={() => start(async () => { await setEntryAiAccess(entry.id, !entry.ai_access); router.refresh(); })}
          className="inline-flex items-center gap-1.5 hover:text-ink-soft"
          aria-pressed={entry.ai_access}
        >
          <Lock size={12} />
          {entry.ai_access ? "Claude may recall this entry in conversations. Make private?" : "Private from conversations. Allow Claude to recall it?"}
        </button>
        <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 hover:text-danger">
          <Trash2 size={12} /> Delete entry
        </button>
      </div>
      {unfiltered && <p className="mt-3 text-[12px] text-ink-faint">Unfiltered entries are never sent to the AI, whatever the setting above.</p>}

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this entry?">
        <p className="font-serif text-[16px] text-ink-soft">It will be removed permanently, along with any AI notes about it.</p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={() => start(() => deleteEntry(entry.id))} disabled={pending}>
            Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}
