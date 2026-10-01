"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUp } from "lucide-react";
import { startConversation } from "@/lib/actions/conversations";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Start the conversation"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-[filter,opacity] hover:brightness-110 disabled:opacity-50"
    >
      {pending ? <span className="typing-dot" /> : <ArrowUp size={19} />}
    </button>
  );
}

/** The central entry point: say what's on your mind, land in a conversation. */
export function AskField() {
  const [value, setValue] = useState("");
  const [offRecord, setOffRecord] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={startConversation} className="text-left">
      <div className="flex items-end gap-3 rounded-[26px] border border-line-strong bg-raised/70 p-2 pl-5 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)] backdrop-blur-md transition-colors focus-within:border-accent/50">
        <label htmlFor="ask" className="sr-only">
          What&apos;s on your mind?
        </label>
        <textarea
          id="ask"
          name="text"
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (value.trim() || offRecord) form.current?.requestSubmit();
            }
          }}
          placeholder="What’s on your mind?"
          className="page-text field max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[19px] placeholder:text-ink-faint"
        />
        <input type="hidden" name="off_record" value={offRecord ? "1" : "0"} />
        <Send />
      </div>
      <div className="mt-3 flex justify-center">
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-faint hover:text-ink-soft">
          <input type="checkbox" checked={offRecord} onChange={(e) => setOffRecord(e.target.checked)} className="accent-[var(--accent)]" />
          Off the record — nothing from this conversation is saved
        </label>
      </div>
    </form>
  );
}
