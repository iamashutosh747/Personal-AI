"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { attributeFromObservation } from "@/lib/actions/mirror";
import { ATTRIBUTE_KINDS, ATTRIBUTE_LABELS, type AttributeKind, type Observation } from "@/lib/types";
import { ObservationCard } from "@/components/reflect/ObservationCard";

export function MirrorObservations({ observations }: { observations: Observation[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function look() {
    setRunning(true);
    setNote(null);
    const res = await fetch("/api/mirror", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as { created?: number; error?: string };
    setRunning(false);
    if (!res.ok) setNote(json.error ?? "Something went wrong.");
    else {
      if (!json.created) setNote("Nothing stood out clearly enough to mention.");
      router.refresh();
    }
  }

  return (
    <section>
      <h2 className="display text-[34px]">What the AI notices</h2>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-faint">
        Suggestions, not verdicts. Each one shows the memories or entries it came from. Agree, disagree, correct it, or adopt it in your own
        words. Nothing is added to your Mirror unless you do.
      </p>
      <button
        onClick={look}
        disabled={running}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-dashed border-accent-2/50 px-4 text-[13.5px] text-accent-2 hover:bg-accent-2/10 disabled:opacity-50"
      >
        <Sparkles size={14} /> {running ? "Looking…" : "Look for patterns"}
      </button>
      {note && <p className="mt-3 text-[13px] text-ink-soft">{note}</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {observations.map((o) => (
          <div key={o.id}>
            <ObservationCard observation={o} />
            {o.status !== "rejected" && <Adopt observation={o} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Adopt({ observation }: { observation: Observation }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AttributeKind>(observation.kind === "priority_shift" ? "priority" : "interest");
  const [label, setLabel] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-2 pl-1 text-[12px] text-ok">Added to your Mirror, in your words.</p>;
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-2 pl-1 text-[12px] text-ink-faint hover:text-ink-soft">
        Add something to my Mirror from this →
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await attributeFromObservation(observation.id, kind, label);
          if (r.ok) setDone(true);
        });
      }}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line p-3"
    >
      <select value={kind} onChange={(e) => setKind(e.target.value as AttributeKind)} aria-label="Section" className="field bg-transparent text-[13px] [&>option]:bg-raised">
        {ATTRIBUTE_KINDS.map((k) => (
          <option key={k} value={k}>
            {ATTRIBUTE_LABELS[k]}
          </option>
        ))}
      </select>
      <input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="In your own words" aria-label="In your own words" className="field min-w-0 flex-1 border-b border-line bg-transparent py-1 text-[14px] focus:border-accent" />
      <button type="submit" disabled={pending || !label.trim()} className="h-8 rounded-full bg-accent px-3 text-[12.5px] text-accent-ink disabled:opacity-40">
        Add
      </button>
    </form>
  );
}
