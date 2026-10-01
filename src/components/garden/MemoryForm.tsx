"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createMemory, updateMemory, type ActionState } from "@/lib/actions/memories";
import { MEMORY_KINDS, MEMORY_KIND_LABELS, type Memory, type MemoryKind } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { Dictation } from "@/components/ui/Dictation";
import { cn } from "@/lib/cn";
import { PhotoPicker, VoiceRecorder, uploadMedia } from "./MediaTools";

export function MemoryForm({
  memory,
  defaultAiAccess,
  onDone,
}: {
  memory?: Memory;
  defaultAiAccess: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(memory);
  const action = editing ? updateMemory.bind(null, memory!.id) : createMemory;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, { ok: false });
  const [kind, setKind] = useState<MemoryKind>(memory?.kind ?? "reflection");
  const [aiAccess, setAiAccess] = useState(memory?.ai_access ?? defaultAiAccess);
  const [body, setBody] = useState(memory?.body ?? "");
  const [queued, setQueued] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok || !state.id) return;
    if (editing) {
      onDone?.();
      router.refresh();
      return;
    }
    // New memory saved: attach queued media, then open it.
    const id = state.id;
    (async () => {
      if (queued.length) {
        setUploading(true);
        for (const f of queued) {
          const r = await uploadMedia(f, { memoryId: id });
          if (r.error) setUploadError(`${f.name}: ${r.error}`);
        }
        setUploading(false);
      }
      router.push(`/garden/${id}?saved=1`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-10">
      {!editing && <input type="hidden" name="stay" value="1" />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ai_access" value={aiAccess ? "true" : "false"} />

      <fieldset>
        <legend className="eyebrow mb-3">What kind of memory</legend>
        <div className="flex flex-wrap gap-2">
          {MEMORY_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                kind === k ? "bg-accent-soft text-accent" : "border border-line text-ink-faint hover:text-ink-soft",
              )}
            >
              {MEMORY_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="title" className="sr-only">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={memory?.title}
          placeholder="Give it a name"
          className="field w-full border-b border-line-strong bg-transparent pb-3 font-display text-[36px] leading-tight placeholder:text-ink-faint/70 focus:border-accent sm:text-[44px]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="body">In your words</Label>
          <Dictation onText={(t) => setBody((b) => (b ? `${b.trimEnd()} ${t}` : t))} />
        </div>
        <textarea
          id="body"
          name="body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, what you noticed, why it matters…"
          className="page-text field w-full resize-y bg-transparent placeholder:text-ink-faint"
        />
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <Label htmlFor="occurred_on">When</Label>
          <Input id="occurred_on" name="occurred_on" type="date" defaultValue={memory?.occurred_on ?? ""} className="[color-scheme:dark]" />
        </div>
        <div>
          <Label htmlFor="location" hint="optional">Where</Label>
          <Input id="location" name="location" defaultValue={memory?.location ?? ""} maxLength={200} placeholder="A place" />
        </div>
        <div>
          <Label htmlFor="tags" hint="comma separated">Tags</Label>
          <Input id="tags" name="tags" defaultValue={memory?.tags.join(", ") ?? ""} placeholder="travel, family, work" />
        </div>
        <div>
          <Label htmlFor="category" hint="optional">Your own category</Label>
          <Input id="category" name="category" defaultValue={memory?.category ?? ""} maxLength={60} placeholder="e.g. The Lisbon years" />
        </div>
      </div>

      {!editing && (
        <div>
          <p className="eyebrow mb-3">Photographs & voice</p>
          <div className="flex flex-wrap items-center gap-3">
            <PhotoPicker onFiles={(f) => setQueued((q) => [...q, ...f])} />
            <VoiceRecorder onRecorded={(f) => setQueued((q) => [...q, f])} />
          </div>
          {queued.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {queued.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-full border border-line py-1 pl-3 pr-1 text-[12.5px] text-ink-soft">
                  {f.type.startsWith("audio") ? "Voice note" : f.name}
                  <button type="button" aria-label="Remove" onClick={() => setQueued((q) => q.filter((_, j) => j !== i))} className="rounded-full p-1 hover:bg-sunken">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-t border-line pt-2">
        <Toggle
          checked={aiAccess}
          onChange={setAiAccess}
          label="Available to the AI"
          description="When on, Claude may draw on this memory in conversations. When off, it stays between you and the page."
        />
      </div>

      {(state.error || uploadError) && (
        <p role="alert" className="text-[13px] text-danger">
          {state.error ?? uploadError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {editing && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={pending || uploading}>
          {uploading ? "Attaching…" : pending ? "Keeping…" : editing ? "Save changes" : "Keep this memory"}
        </Button>
      </div>
    </form>
  );
}
