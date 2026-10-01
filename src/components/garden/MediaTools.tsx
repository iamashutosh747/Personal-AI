"use client";

import { useEffect, useRef, useState } from "react";
import { useClientValue } from "@/lib/hooks";
import { ImagePlus, Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type MediaOwner = { memoryId: string } | { capsuleId: string } | { journalId: string };

export interface MediaItem {
  id: string;
  kind: "image" | "audio";
  mime: string;
  caption: string | null;
}

export async function uploadMedia(file: File, owner: MediaOwner): Promise<{ media?: MediaItem; error?: string }> {
  const form = new FormData();
  form.set("file", file);
  for (const [k, v] of Object.entries(owner)) form.set(k, v);
  const res = await fetch("/api/media", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { media?: MediaItem; error?: string };
  if (!res.ok) return { error: json.error ?? "Upload failed" };
  return json;
}

export function PhotoPicker({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
      >
        <ImagePlus size={16} /> Add photographs
      </button>
    </>
  );
}

function pickAudioType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

/** Record a voice note in the browser. Nothing leaves the device until you keep it. */
export function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (file: File) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "denied">("idle");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = useClientValue(() => pickAudioType() !== null && Boolean(navigator.mediaDevices?.getUserMedia), true);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = pickAudioType() || undefined;
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || type || "audio/webm").split(";")[0]!;
        const ext = mime.includes("mp4") || mime.includes("aac") ? "m4a" : "webm";
        const file = new File(chunks, `voice-${Date.now()}.${ext}`, { type: mime });
        if (file.size > 0) onRecorded(file);
      };
      rec.current = r;
      r.start(1000);
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch {
      setState("denied");
    }
  }

  function stop() {
    rec.current?.stop();
    if (timer.current) clearInterval(timer.current);
    setState("idle");
  }

  if (!supported) return <span className="text-[12px] text-ink-faint">Voice recording isn’t supported in this browser.</span>;

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={state === "recording" ? stop : start}
        aria-pressed={state === "recording"}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13.5px] transition-colors disabled:opacity-40",
          state === "recording" ? "border-danger/50 text-danger" : "border-line text-ink-soft hover:border-line-strong hover:text-ink",
        )}
      >
        {state === "recording" ? <Square size={13} fill="currentColor" /> : <Mic size={16} />}
        {state === "recording" ? `Stop · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Record a voice note"}
      </button>
      {state === "denied" && <span className="text-[12px] text-ink-faint">Microphone access was blocked.</span>}
    </span>
  );
}

export function MediaGallery({ items, onRemove, readOnly }: { items: MediaItem[]; onRemove?: (id: string) => void; readOnly?: boolean }) {
  const images = items.filter((i) => i.kind === "image");
  const audio = items.filter((i) => i.kind === "audio");
  if (!items.length) return null;
  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div className={cn("grid gap-3", images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
          {images.map((m) => (
            <figure key={m.id} className="group relative overflow-hidden rounded-2xl border border-line bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated media */}
              <img
                src={`/api/media/${m.id}`}
                alt={m.caption ?? "A photograph you kept"}
                loading="lazy"
                className={cn("w-full object-cover", images.length === 1 ? "max-h-[520px]" : "aspect-square")}
              />
              {m.mime.includes("hei") && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[11px] text-ink-soft">
                  HEIC photos display in Safari. Other browsers may not show them.
                </figcaption>
              )}
              {!readOnly && onRemove && (
                <button
                  onClick={() => onRemove(m.id)}
                  aria-label="Remove photograph"
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-ink opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 max-sm:opacity-80"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {audio.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-raised/60 p-3">
          <audio controls preload="metadata" src={`/api/media/${m.id}`} className="h-10 w-full" />
          {!readOnly && onRemove && (
            <button onClick={() => onRemove(m.id)} aria-label="Remove recording" className="rounded-full p-2 text-ink-faint hover:text-danger">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
