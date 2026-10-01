"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { approveProposal, dismissProposal } from "@/lib/actions/proposals";
import { AiLabel } from "@/components/ui/Tag";
import { MEMORY_KIND_LABELS, type MemoryKind } from "@/lib/types";
import { cn } from "@/lib/cn";

export interface ProposalView {
  id: string;
  action: "create" | "update" | "forget";
  title: string | null;
  body: string | null;
  kind: MemoryKind | null;
  tags: string[];
  reason: string | null;
  target_memory_id: string | null;
  target_title?: string | null;
}

/** An AI suggestion that waits for the person: approve, edit first, or dismiss. */
export function ProposalCard({ proposal, compact }: { proposal: ProposalView; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "editing" | "approved" | "dismissed">("idle");
  const [title, setTitle] = useState(proposal.title ?? "");
  const [body, setBody] = useState(proposal.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const verb = proposal.action === "create" ? "Keep this as a memory?" : proposal.action === "update" ? "Correct a memory?" : "Forget a memory?";

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveProposal(
        proposal.id,
        state === "editing" ? { title: title.trim() || undefined, body } : undefined,
      );
      if (!res.ok) setError(res.error ?? "Could not save");
      else {
        setMemoryId(res.memoryId ?? null);
        setState("approved");
      }
    });
  }

  function dismiss() {
    start(async () => {
      await dismissProposal(proposal.id);
      setState("dismissed");
    });
  }

  if (state === "dismissed") {
    return <p className="text-[12.5px] italic text-ink-faint">Suggestion dismissed.</p>;
  }
  if (state === "approved") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-ok">
        <Check size={14} />
        {proposal.action === "forget" ? "Forgotten." : "Kept."}
        {memoryId && (
          <Link href={`/garden/${memoryId}`} className="text-ink-faint underline-offset-4 hover:underline">
            Open in the garden
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-dashed border-accent-2/35 bg-accent-2/[0.04]", compact ? "p-4" : "p-5")}>
      <div className="flex flex-wrap items-center gap-2">
        <AiLabel label="suggestion" />
        <span className="text-[13px] text-ink-soft">{verb}</span>
        {proposal.kind && proposal.action === "create" && (
          <span className="text-[12px] text-ink-faint">· {MEMORY_KIND_LABELS[proposal.kind]}</span>
        )}
      </div>

      {proposal.action !== "create" && proposal.target_memory_id && (
        <p className="mt-2 text-[13px] text-ink-faint">
          Memory:{" "}
          <Link href={`/garden/${proposal.target_memory_id}`} className="text-ink-soft underline-offset-4 hover:underline">
            {proposal.target_title ?? "open it"}
          </Link>
        </p>
      )}

      {state === "editing" ? (
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Title"
            className="field w-full border-b border-line-strong bg-transparent py-1.5 font-display text-[20px] focus:border-accent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Memory text"
            rows={4}
            className="page-text field w-full resize-y rounded-lg bg-sunken p-3 text-[16px]"
          />
        </div>
      ) : (
        proposal.action !== "forget" && (
          <div className="mt-3">
            {proposal.title && <p className="font-display text-[21px] leading-tight">{proposal.title}</p>}
            {proposal.body && <p className="mt-1 whitespace-pre-wrap font-serif text-[15.5px] leading-relaxed text-ink-soft">{proposal.body}</p>}
            {proposal.tags.length > 0 && <p className="mt-2 text-[12px] text-ink-faint">#{proposal.tags.join("  #")}</p>}
          </div>
        )
      )}

      {proposal.reason && <p className="mt-3 text-[12.5px] italic text-ink-faint">Why: {proposal.reason}</p>}
      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={approve}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-medium text-accent-ink disabled:opacity-50"
        >
          <Check size={14} />
          {proposal.action === "forget" ? "Forget it" : state === "editing" ? "Save my version" : "Approve"}
        </button>
        {proposal.action !== "forget" && state !== "editing" && (
          <button
            onClick={() => setState("editing")}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-ink-soft hover:border-line-strong"
          >
            <Pencil size={13} /> Edit first
          </button>
        )}
        <button
          onClick={dismiss}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-faint hover:text-ink-soft"
        >
          <X size={14} /> Dismiss
        </button>
      </div>
    </div>
  );
}
