"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { quickCapture, type ActionState } from "@/lib/actions/memories";
import { cn } from "@/lib/cn";

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Capture">
      {/* Modal content mounts fresh each time it opens, so every capture starts clean. */}
      <CaptureSession onClose={onClose} />
    </Modal>
  );
}

function CaptureSession({ onClose }: { onClose: () => void }) {
  const [round, setRound] = useState(0);
  return <CaptureForm key={round} onClose={onClose} onAnother={() => setRound((r) => r + 1)} />;
}

function CaptureForm({ onClose, onAnother }: { onClose: () => void; onAnother: () => void }) {
  const [as, setAs] = useState<"memory" | "journal">("memory");
  const [state, action, pending] = useActionState<ActionState, FormData>(quickCapture, { ok: false });
  const formRef = useRef<HTMLFormElement>(null);

  if (state.ok) {
    return (
      <div className="py-4 text-center">
        <p className="font-serif text-[18px] italic text-ink-soft">Kept.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={onAnother}>
            Capture another
          </Button>
          <Link
            href={as === "memory" ? `/garden/${state.id}` : `/reflect/${state.id}`}
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-full border border-line px-5 text-[14px] hover:border-line-strong"
          >
            Open it
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div role="radiogroup" aria-label="Save as" className="flex gap-2">
        {(["memory", "journal"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={as === v}
            onClick={() => setAs(v)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
              as === v ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink-soft",
            )}
          >
            {v === "memory" ? "A memory" : "A journal fragment"}
          </button>
        ))}
      </div>
      <input type="hidden" name="as" value={as} />
      <textarea
        name="text"
        required
        rows={5}
        autoFocus
        aria-label={as === "memory" ? "Memory" : "Journal fragment"}
        placeholder={as === "memory" ? "Something worth keeping…" : "Whatever is on your mind…"}
        className="page-text field w-full resize-none rounded-xl bg-sunken p-4 placeholder:text-ink-faint"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formRef.current?.requestSubmit();
        }}
      />
      {as === "memory" && (
        <input
          name="tags"
          aria-label="Tags"
          placeholder="tags, separated by commas (optional)"
          className="field w-full border-b border-line bg-transparent py-2 text-[14px] placeholder:text-ink-faint focus:border-accent"
        />
      )}
      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-faint">⌘↵ to save</span>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Keeping…" : "Keep it"}
        </Button>
      </div>
    </form>
  );
}
