"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Archive, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { addAttribute, deleteAttribute, restoreAttribute, retireAttribute, updateAttribute, type MirrorState } from "@/lib/actions/mirror";
import { ATTRIBUTE_LABELS, type AttributeKind, type SelfAttribute } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/cn";

const PLACEHOLDER: Record<AttributeKind, string> = {
  value: "e.g. Honesty, even when it costs something",
  interest: "e.g. Ceramics",
  goal: "e.g. Run a half marathon",
  favorite: "e.g. The Remains of the Day",
  milestone: "e.g. Moved to Lisbon",
  priority: "e.g. Time with my sister",
};

export function AttributeSection({ kind, items, past }: { kind: AttributeKind; items: SelfAttribute[]; past: SelfAttribute[] }) {
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  return (
    <section className="rounded-3xl border border-line bg-raised/30 p-6">
      <div className="flex items-center justify-between">
        <h2 className="display text-[28px]">{ATTRIBUTE_LABELS[kind]}</h2>
        <button onClick={() => setAdding((v) => !v)} aria-label={`Add to ${ATTRIBUTE_LABELS[kind]}`} className="rounded-full p-2 text-ink-faint hover:bg-raised hover:text-accent">
          <Plus size={17} />
        </button>
      </div>
      {adding && <AddForm kind={kind} onDone={() => setAdding(false)} />}
      <ul className="mt-3 space-y-1">
        {items.map((a) => (
          <AttributeRow key={a.id} a={a} ranked={kind === "priority"} />
        ))}
        {items.length === 0 && !adding && <li className="py-2 font-serif text-[15px] text-ink-faint">Nothing here yet.</li>}
      </ul>
      {past.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button onClick={() => setShowPast((v) => !v)} className="text-[12px] text-ink-faint hover:text-ink-soft">
            {showPast ? "Hide" : "Show"} {past.length} no longer current
          </button>
          {showPast && (
            <ul className="mt-2 space-y-1">
              {past.map((a) => (
                <AttributeRow key={a.id} a={a} past />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AttributeRow({ a, ranked, past }: { a: SelfAttribute; ranked?: boolean; past?: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(a.label);
  return (
    <li className={cn("group flex items-start justify-between gap-3 rounded-xl px-2 py-2 hover:bg-raised/60", past && "opacity-60")}>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                await updateAttribute(a.id, { label });
                setEditing(false);
              });
            }}
          >
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => setEditing(false)}
              autoFocus
              aria-label="Edit"
              className="field w-full border-b border-accent bg-transparent text-[15.5px]"
            />
          </form>
        ) : (
          <button onClick={() => !past && setEditing(true)} className="block w-full text-left text-[15.5px] text-ink">
            {ranked && a.rank ? <span className="mr-2 text-accent">{a.rank}.</span> : null}
            {a.label}
          </button>
        )}
        {a.detail && <p className="text-[13px] text-ink-faint">{a.detail}</p>}
        <p className="text-[11px] text-ink-faint">
          since {formatDate(a.since, { month: "short", year: "numeric" })}
          {a.until && ` · until ${formatDate(a.until, { month: "short", year: "numeric" })}`}
          {a.origin === "observation" && " · from an AI observation you adopted"}
          {!a.ai_access && " · private"}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-70">
        {past ? (
          <button aria-label="Make current again" disabled={pending} onClick={() => start(() => restoreAttribute(a.id))} className="rounded-full p-1.5 text-ink-faint hover:text-ink">
            <RotateCcw size={13} />
          </button>
        ) : (
          <>
            <button
              aria-label={a.ai_access ? "Keep private from the AI" : "Share with the AI"}
              aria-pressed={!a.ai_access}
              disabled={pending}
              onClick={() => start(() => updateAttribute(a.id, { ai_access: !a.ai_access }))}
              className={cn("rounded-full p-1.5 hover:text-ink", a.ai_access ? "text-ink-faint" : "text-accent")}
            >
              <Lock size={13} />
            </button>
            <button aria-label="No longer true" title="No longer true (kept in history)" disabled={pending} onClick={() => start(() => retireAttribute(a.id))} className="rounded-full p-1.5 text-ink-faint hover:text-ink">
              <Archive size={13} />
            </button>
          </>
        )}
        <button aria-label="Delete" disabled={pending} onClick={() => start(() => deleteAttribute(a.id))} className="rounded-full p-1.5 text-ink-faint hover:text-danger">
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

function AddForm({ kind, onDone }: { kind: AttributeKind; onDone: () => void }) {
  const [state, action, pending] = useActionState<MirrorState, FormData>(addAttribute, { ok: false });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      onDone();
    }
  }, [state, onDone]);
  return (
    <form ref={form} action={action} className="mt-3 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input name="label" required maxLength={200} autoFocus placeholder={PLACEHOLDER[kind]} aria-label="Label" className="field w-full border-b border-line-strong bg-transparent py-2 text-[15px] focus:border-accent" />
      <input name="detail" maxLength={2000} placeholder="A note (optional)" aria-label="Note" className="field w-full border-b border-line bg-transparent py-1.5 text-[13.5px] focus:border-accent" />
      <div className="flex items-center gap-3">
        {kind === "priority" && (
          <input name="rank" type="number" min={1} max={99} placeholder="Rank" aria-label="Rank" className="field w-20 border-b border-line bg-transparent py-1.5 text-[13.5px]" />
        )}
        <label className="flex items-center gap-2 text-[12px] text-ink-faint">
          since
          <input name="since" type="date" aria-label="Since" className="field border-b border-line bg-transparent py-1 text-[12.5px] [color-scheme:dark]" />
        </label>
        <button type="submit" disabled={pending} className="ml-auto h-8 rounded-full bg-accent px-3.5 text-[13px] text-accent-ink disabled:opacity-50">
          Add
        </button>
      </div>
      {state.error && <p className="text-[12px] text-danger">{state.error}</p>}
    </form>
  );
}
