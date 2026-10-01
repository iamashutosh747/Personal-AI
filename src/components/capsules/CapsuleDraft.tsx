"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { saveCapsuleDraft, sealCapsule } from "@/lib/actions/capsules";
import type { Capsule, Media } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Label } from "@/components/ui/Field";
import { Dictation } from "@/components/ui/Dictation";
import { MediaGallery, PhotoPicker, VoiceRecorder, uploadMedia, type MediaItem } from "@/components/garden/MediaTools";
import { Seal } from "./Seal";
import { DeleteCapsule } from "./DeleteCapsule";

function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CapsuleDraft({
  capsule,
  letter: initialLetter,
  media,
  memoryOptions,
  displayName,
}: {
  capsule: Capsule;
  letter: string;
  media: Media[];
  memoryOptions: { id: string; title: string }[];
  displayName: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(capsule.title);
  const [letter, setLetter] = useState(initialLetter || (displayName ? `Dear ${displayName},\n\n` : "Dear me,\n\n"));
  const [openOn, setOpenOn] = useState(localDate(capsule.open_at));
  const [goals, setGoals] = useState<string[]>(capsule.goals.length ? capsule.goals : [""]);
  const [memoryIds, setMemoryIds] = useState<string[]>(capsule.memory_ids);
  const [items, setItems] = useState<MediaItem[]>(media);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmSeal, setConfirmSeal] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [pending, start] = useTransition();
  const dirty = useRef(false);

  const [tomorrow] = useState(() => localDate(new Date(Date.now() + 86400000).toISOString()));

  const save = async () => {
    const res = await saveCapsuleDraft(capsule.id, {
      title,
      letter,
      open_on: openOn,
      tz_offset_minutes: new Date(`${openOn}T00:00:00`).getTimezoneOffset(),
      memory_ids: memoryIds,
      goals: goals.map((g) => g.trim()).filter(Boolean),
    });
    setStatus(res.ok ? "Draft saved" : res.error ?? "Not saved");
    dirty.current = !res.ok;
    return res.ok;
  };

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, letter, openOn, goals, memoryIds]);

  const touch = () => {
    dirty.current = true;
    setStatus(null);
  };

  async function addFiles(files: File[]) {
    for (const f of files) {
      const r = await uploadMedia(f, { capsuleId: capsule.id });
      if (r.media) setItems((p) => [...p, r.media!]);
      else setStatus(r.error ?? "Upload failed");
    }
  }

  return (
    <div className="pb-10 pt-8">
      <p className="eyebrow">An unsealed letter</p>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          touch();
        }}
        aria-label="Title"
        maxLength={200}
        className="field mt-4 w-full bg-transparent font-display text-[40px] leading-tight sm:text-[48px]"
      />

      <div className="mt-6 rounded-[28px] border border-line bg-[color-mix(in_oklab,var(--ink)_3%,var(--bg))] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] sm:p-10">
        <div className="mb-2 flex justify-end">
          <Dictation onText={(t) => { setLetter((l) => `${l.trimEnd()} ${t}`); touch(); }} />
        </div>
        <textarea
          value={letter}
          onChange={(e) => {
            setLetter(e.target.value);
            touch();
          }}
          aria-label="Your letter"
          rows={16}
          className="page-text field w-full resize-y bg-transparent text-[19px]"
        />
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <div>
          <Label htmlFor="open_on">Open on</Label>
          <input
            id="open_on"
            type="date"
            min={tomorrow}
            value={openOn}
            onChange={(e) => {
              setOpenOn(e.target.value);
              touch();
            }}
            className="field w-full border-b border-line-strong bg-transparent py-2.5 text-[15px] [color-scheme:dark] focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
            {[
              ["In 6 months", 182],
              ["In a year", 365],
              ["In 5 years", 1826],
            ].map(([l, d]) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setOpenOn(localDate(new Date(Date.now() + Number(d) * 86400000).toISOString()));
                  touch();
                }}
                className="rounded-full border border-line px-2.5 py-1 text-ink-faint hover:text-ink-soft"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Goals you’re holding now</Label>
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  value={g}
                  onChange={(e) => {
                    setGoals(goals.map((x, j) => (j === i ? e.target.value : x)));
                    touch();
                  }}
                  maxLength={300}
                  aria-label={`Goal ${i + 1}`}
                  placeholder="Something you hope will be true"
                  className="field w-full border-b border-line bg-transparent py-1.5 text-[14.5px] focus:border-accent"
                />
                {goals.length > 1 && (
                  <button type="button" aria-label="Remove goal" onClick={() => { setGoals(goals.filter((_, j) => j !== i)); touch(); }} className="text-ink-faint hover:text-ink">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setGoals([...goals, ""])} className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-ink-faint hover:text-ink-soft">
            <Plus size={13} /> another
          </button>
        </div>
      </div>

      <div className="mt-10">
        <Label>Memories to send forward</Label>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !memoryIds.includes(e.target.value)) {
              setMemoryIds([...memoryIds, e.target.value]);
              touch();
            }
          }}
          aria-label="Add a memory"
          className="field w-full border-b border-line-strong bg-transparent py-2.5 text-[14px] text-ink-soft [&>option]:bg-raised"
        >
          <option value="">Choose a memory…</option>
          {memoryOptions.filter((m) => !memoryIds.includes(m.id)).map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <ul className="mt-3 flex flex-wrap gap-2">
          {memoryIds.map((id) => (
            <li key={id} className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-3 pr-1 text-[12.5px]">
              {memoryOptions.find((m) => m.id === id)?.title ?? "A memory"}
              <button type="button" aria-label="Remove" onClick={() => { setMemoryIds(memoryIds.filter((m) => m !== id)); touch(); }} className="rounded-full p-1 hover:bg-sunken">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <Label>A voice, a picture</Label>
        <div className="flex flex-wrap gap-3">
          <VoiceRecorder onRecorded={(f) => addFiles([f])} />
          <PhotoPicker onFiles={addFiles} />
        </div>
        {items.length > 0 && (
          <div className="mt-4">
            <MediaGallery
              items={items}
              onRemove={async (mid) => {
                const res = await fetch(`/api/media/${mid}`, { method: "DELETE" });
                if (res.ok) setItems((p) => p.filter((m) => m.id !== mid));
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <DeleteCapsule id={capsule.id} />
        <div className="flex items-center gap-3">
          {status && <span className="text-[12.5px] text-ink-faint" aria-live="polite">{status}</span>}
          <Button variant="quiet" onClick={() => start(async () => { await save(); })} disabled={pending}>
            Save draft
          </Button>
          <Button variant="primary" onClick={async () => { if (await save()) setConfirmSeal(true); }} disabled={pending}>
            Seal it
          </Button>
        </div>
      </div>

      <Modal open={confirmSeal} onClose={() => setConfirmSeal(false)} title="Seal this letter?">
        <div className="flex flex-col items-center text-center">
          <Seal size={72} />
          <p className="mt-6 font-serif text-[17px] leading-relaxed text-ink-soft">
            Once sealed, “{title}” can’t be read or changed until{" "}
            <span className="text-ink">{new Date(`${openOn}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "long" })}</span>. Not by you,
            and not by the AI.
          </p>
          <p className="mt-3 text-[12.5px] text-ink-faint">Your data export always includes it, since it is still your data.</p>
          <div className="mt-8 flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmSeal(false)}>
              Not yet
            </Button>
            <Button
              variant="primary"
              disabled={sealing}
              onClick={async () => {
                setSealing(true);
                const r = await sealCapsule(capsule.id);
                setSealing(false);
                if (!r.ok) {
                  setStatus(r.error ?? "Could not seal it");
                  setConfirmSeal(false);
                } else router.push("/capsules");
              }}
            >
              {sealing ? "Sealing…" : "Seal"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
