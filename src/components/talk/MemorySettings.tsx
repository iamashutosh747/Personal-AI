"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Search } from "lucide-react";
import { updateConversationMemory } from "@/lib/actions/conversations";
import type { Conversation } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const MODES: { id: Conversation["memory_mode"]; name: string; note: string }[] = [
  { id: "all", name: "Allowed memories", note: "Claude may search memories you’ve marked available to AI." },
  { id: "chosen", name: "Only the ones I choose", note: "Claude sees exactly the memories you pick below, nothing else." },
  { id: "none", name: "No memory", note: "A clean slate. Nothing saved is read." },
];

export function MemorySettings({
  open,
  onClose,
  conversation,
  options,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  options: { id: string; title: string; kind: string; ai_access: boolean }[];
  onSaved: (mode: Conversation["memory_mode"]) => void;
}) {
  const [mode, setMode] = useState(conversation.memory_mode);
  const [chosen, setChosen] = useState<string[]>(conversation.chosen_memory_ids);
  const [recallable, setRecallable] = useState(conversation.ai_access);
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();

  const visible = useMemo(
    () => options.filter((o) => o.title.toLowerCase().includes(filter.toLowerCase())).slice(0, 80),
    [options, filter],
  );

  return (
    <Modal open={open} onClose={onClose} title="Memory for this conversation" wide>
      <div className="space-y-2" role="radiogroup">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "block w-full rounded-2xl border px-4 py-3 text-left transition-colors",
              mode === m.id ? "border-accent/60 bg-accent-soft" : "border-line hover:border-line-strong",
            )}
          >
            <span className="block text-[15px] text-ink">{m.name}</span>
            <span className="block text-[13px] text-ink-faint">{m.note}</span>
          </button>
        ))}
      </div>

      {mode === "chosen" && (
        <div className="mt-6">
          <div className="flex items-center gap-2 border-b border-line-strong focus-within:border-accent">
            <Search size={15} className="text-ink-faint" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a memory"
              aria-label="Find a memory"
              className="field w-full bg-transparent py-2 text-[14px]"
            />
          </div>
          <ul className="mt-2 max-h-64 overflow-y-auto">
            {visible.map((o) => {
              const on = chosen.includes(o.id);
              return (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setChosen(on ? chosen.filter((x) => x !== o.id) : [...chosen, o.id].slice(0, 50))}
                      className="accent-[var(--accent)]"
                    />
                    <span className="flex-1 truncate text-[14px]">{o.title}</span>
                    {!o.ai_access && (
                      <span className="flex items-center gap-1 text-[11px] text-ink-faint" title="Private: shared only here because you chose it">
                        <Lock size={11} /> private
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
            {visible.length === 0 && <li className="py-4 text-center text-[13px] text-ink-faint">No memories match.</li>}
          </ul>
          <p className="mt-2 text-[12px] text-ink-faint">{chosen.length} chosen. Private memories you pick are shared in this conversation only.</p>
        </div>
      )}

      <div className="mt-6 border-t border-line pt-2">
        <Toggle
          checked={recallable}
          onChange={setRecallable}
          label="Let future conversations recall this one"
          description="Off by default. When on, Claude may find passages from this conversation when they’re relevant later."
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateConversationMemory(conversation.id, { memory_mode: mode, chosen_memory_ids: chosen, ai_access: recallable });
              onSaved(mode);
              onClose();
            })
          }
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}
