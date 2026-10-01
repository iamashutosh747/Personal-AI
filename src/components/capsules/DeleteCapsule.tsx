"use client";

import { useState, useTransition } from "react";
import { deleteCapsule } from "@/lib/actions/capsules";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function DeleteCapsule({ id, sealed }: { id: string; sealed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[12.5px] text-ink-faint hover:text-danger">
        {sealed ? "Destroy this capsule unopened" : "Discard this draft"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={sealed ? "Destroy it unopened?" : "Discard this draft?"}>
        <p className="font-serif text-[16px] leading-relaxed text-ink-soft">
          {sealed ? "The letter will be deleted without ever being read. This can’t be undone." : "The draft and anything attached to it will be deleted."}
        </p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => start(() => deleteCapsule(id))}>
            {sealed ? "Destroy" : "Discard"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
