"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  conversationToJournal,
  deleteConversation,
  renameConversation,
  setConversationArchived,
} from "@/lib/actions/conversations";
import type { Conversation } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function ConversationMenu({ conversation, onMemorySettings }: { conversation: Conversation; onMemorySettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "block w-full rounded-lg px-3 py-2 text-left text-[14px] text-ink-soft hover:bg-sunken hover:text-ink";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-raised hover:text-ink"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-60 rounded-2xl border border-line bg-raised p-1.5 shadow-2xl">
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setRenaming(true); }}>
            Rename
          </button>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onMemorySettings(); }}>
            Memory for this conversation
          </button>
          <button
            role="menuitem"
            className={item}
            disabled={pending}
            onClick={() => start(() => conversationToJournal(conversation.id))}
          >
            {conversation.journal_entry_id ? "Save to journal again" : "Turn into a journal entry"}
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() =>
              start(async () => {
                await setConversationArchived(conversation.id, !conversation.archived);
                setOpen(false);
                if (!conversation.archived) router.push("/talk");
              })
            }
          >
            {conversation.archived ? "Unarchive" : "Archive"}
          </button>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" className={`${item} !text-danger`} onClick={() => { setOpen(false); setConfirmDelete(true); }}>
            Delete…
          </button>
        </div>
      )}

      <Modal open={renaming} onClose={() => setRenaming(false)} title="Rename">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await renameConversation(conversation.id, title);
              setRenaming(false);
              router.refresh();
            });
          }}
          className="space-y-6"
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus aria-label="Title" />
          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={pending || !title.trim()}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this conversation?">
        <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
          Every message in it is removed permanently. Memories you kept from it stay in your garden.
        </p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => start(() => deleteConversation(conversation.id))}>
            Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}
