"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { saveEntry } from "@/lib/actions/journal";
import { MOODS } from "@/lib/prompts";
import { JOURNAL_MODE_LABELS, type JournalMode } from "@/lib/types";
import { Dictation } from "@/components/ui/Dictation";
import { cn } from "@/lib/cn";

export function JournalEditor({
  mode,
  prompts,
  revisit,
  initial,
}: {
  mode: JournalMode;
  prompts: string[];
  revisit?: { id: string; title: string | null; body: string; created_at: string } | null;
  initial?: { id: string; title: string | null; body: string; mood: string | null };
}) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [mood, setMood] = useState<string | null>(initial?.mood ?? null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [focus, setFocus] = useState(mode === "unfiltered");
  const dirty = useRef(false);
  const saving = useRef(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(async () => {
    if (!dirty.current || saving.current) return;
    if (!body.trim() && !title.trim()) return;
    saving.current = true;
    dirty.current = false;
    setStatus("saving");
    const res = await saveEntry(id, {
      mode,
      title: title || null,
      body,
      mood,
      prompt: prompts[0] ?? null,
      revisits_id: revisit?.id ?? null,
    });
    saving.current = false;
    if (res.ok && res.id) {
      if (!id) {
        setId(res.id);
        window.history.replaceState(null, "", `/reflect/${res.id}/edit`);
      }
      setStatus("saved");
    } else {
      dirty.current = true;
      setStatus("error");
    }
  }, [body, title, mood, id, mode, prompts, revisit]);

  // Autosave after a pause in typing, and when leaving.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [body, title, mood, save]);

  useEffect(() => {
    const flush = () => void save();
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
      if (e.key === "Escape" && focus) setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, focus]);

  const touch = () => {
    dirty.current = true;
    setStatus("idle");
  };

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className={cn(focus && "fixed inset-0 z-40 overflow-y-auto bg-bg")}>
      <div className={cn("mx-auto max-w-2xl px-5 sm:px-8", focus ? "pb-24 pt-safe" : "pb-10")}>
        <div className="flex h-16 items-center justify-between">
          <Link
            href={id ? `/reflect/${id}` : "/reflect"}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-faint hover:text-ink-soft"
          >
            <ArrowLeft size={14} /> {id ? "Done" : "Reflection Room"}
          </Link>
          <div className="flex items-center gap-3 text-[12px] text-ink-faint">
            <span aria-live="polite">
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved, retrying" : ""}
            </span>
            <span>{words} words</span>
            <Dictation
              onText={(t) => {
                setBody((b) => (b ? `${b.trimEnd()} ${t}` : t));
                touch();
              }}
            />
            <button
              onClick={() => setFocus((f) => !f)}
              aria-label={focus ? "Leave focus mode" : "Focus mode"}
              className="rounded-full p-2 hover:bg-raised hover:text-ink"
            >
              {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        <p className="eyebrow mt-6">{JOURNAL_MODE_LABELS[mode].name}</p>

        {revisit && (
          <aside className="mt-6 rounded-2xl border border-line bg-raised/50 p-5">
            <p className="text-[12px] text-ink-faint">You wrote, on {new Date(revisit.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}:</p>
            {revisit.title && <p className="display mt-2 text-[22px]">{revisit.title}</p>}
            <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-serif text-[16px] leading-relaxed text-ink-soft">{revisit.body}</p>
            <p className="mt-4 text-[13px] italic text-ink-faint">What has changed since? What hasn’t?</p>
          </aside>
        )}

        {prompts.length > 0 && !revisit && (
          <ul className="mt-6 space-y-2">
            {prompts.map((p) => (
              <li key={p} className="display text-[24px] leading-snug text-ink-soft sm:text-[28px]">
                {p}
              </li>
            ))}
          </ul>
        )}

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            touch();
          }}
          placeholder="Title (optional)"
          aria-label="Title"
          maxLength={200}
          className="field mt-8 w-full bg-transparent font-display text-[30px] placeholder:text-ink-faint/50"
        />

        <textarea
          ref={textRef}
          value={body}
          autoFocus
          onChange={(e) => {
            setBody(e.target.value);
            touch();
            e.target.style.height = "auto";
            e.target.style.height = `${Math.max(e.target.scrollHeight, 320)}px`;
          }}
          aria-label="Entry"
          placeholder={mode === "unfiltered" ? "Just write." : "Begin anywhere…"}
          className="page-text field mt-4 min-h-[50vh] w-full resize-none bg-transparent text-[19px] placeholder:text-ink-faint/60"
        />

        {mode !== "unfiltered" && (
          <div className="mt-10 border-t border-line pt-6">
            <p className="eyebrow mb-3">Mood, if you like</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMood(mood === m ? null : m);
                    touch();
                  }}
                  aria-pressed={mood === m}
                  className={cn(
                    "rounded-full px-3 py-1 text-[13px] transition-colors",
                    mood === m ? "bg-accent-soft text-accent" : "border border-line text-ink-faint hover:text-ink-soft",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {id && (
          <div className="mt-10 flex justify-end">
            <button
              onClick={async () => {
                await save();
                router.push(`/reflect/${id}`);
              }}
              className="h-11 rounded-full bg-accent px-6 text-[14px] font-medium text-accent-ink"
            >
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
