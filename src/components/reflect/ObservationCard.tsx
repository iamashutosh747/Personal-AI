"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, PenLine, Trash2, X } from "lucide-react";
import { deleteObservation, reviewObservation } from "@/lib/actions/observations";
import type { Observation } from "@/lib/types";
import { AiLabel } from "@/components/ui/Tag";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/cn";

const KIND_WORD: Record<Observation["kind"], string> = {
  theme: "Theme",
  priority_shift: "Shift in priorities",
  pattern: "Pattern",
  summary: "Summary",
  question: "Question",
  connection: "Connection",
};

function sourceHref(s: Observation["sources"][number]) {
  if (s.type === "journal") return `/reflect/${s.id}`;
  if (s.type === "memory") return `/garden/${s.id}`;
  if (s.type === "attribute") return "/mirror";
  return null;
}

/**
 * An AI observation, always visibly AI, always traceable to its sources, and
 * always open to the person's verdict.
 */
export function ObservationCard({ observation, hideReview }: { observation: Observation; hideReview?: boolean }) {
  const [o, setO] = useState(observation);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(observation.correction ?? "");
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;

  const isQuestion = o.kind === "question";
  const review = (next: Observation["status"], text?: string) =>
    start(async () => {
      const r = await reviewObservation(o.id, next, text);
      if (r.ok) setO({ ...o, status: next, correction: next === "corrected" ? text ?? null : null });
      setCorrecting(false);
    });

  return (
    <article
      className={cn(
        "rounded-2xl border border-dashed p-5 transition-opacity",
        o.status === "rejected" ? "border-line opacity-50" : "border-accent-2/30 bg-accent-2/[0.03]",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <AiLabel label={isQuestion ? "question" : o.kind === "summary" ? "summary" : o.label} />
        {!isQuestion && <span className="text-[12px] text-ink-faint">{KIND_WORD[o.kind]}</span>}
        {o.period_start && (
          <span className="text-[12px] text-ink-faint">
            · {formatDate(o.period_start, { day: "numeric", month: "short" })} – {formatDate(o.period_end, { day: "numeric", month: "short" })}
          </span>
        )}
        {o.status !== "pending" && !isQuestion && (
          <span className={cn("ml-auto text-[11.5px]", o.status === "accepted" ? "text-ok" : o.status === "rejected" ? "text-ink-faint" : "text-accent")}>
            {o.status === "accepted" ? "You agreed" : o.status === "rejected" ? "You disagreed" : "You corrected this"}
          </span>
        )}
      </header>

      <p className={cn("mt-3 font-serif text-[17px] leading-relaxed", o.status === "corrected" && "text-ink-faint line-through decoration-ink-faint/40")}>
        {o.statement}
      </p>
      {o.status === "corrected" && o.correction && (
        <p className="mt-2 font-serif text-[17px] leading-relaxed text-ink">
          <span className="mr-2 text-[11px] uppercase tracking-wider text-accent">Your words</span>
          {o.correction}
        </p>
      )}

      {o.sources.length > 0 && (
        <details className="mt-3 text-[12.5px] text-ink-faint">
          <summary className="cursor-pointer hover:text-ink-soft">
            Based on {o.sources.length} {o.sources.length === 1 ? "record" : "records"}
          </summary>
          <ul className="mt-2 space-y-2 border-l border-line pl-3">
            {o.sources.map((s, i) => {
              const href = sourceHref(s);
              return (
                <li key={i}>
                  {href ? (
                    <Link href={href} className="italic text-ink-soft hover:text-accent">
                      “{s.excerpt.slice(0, 160)}
                      {s.excerpt.length > 160 ? "…" : ""}”
                    </Link>
                  ) : (
                    <span className="italic">“{s.excerpt.slice(0, 160)}”</span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {correcting && (
        <div className="mt-3">
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={3}
            aria-label="Your correction"
            placeholder="How would you put it?"
            className="page-text field w-full rounded-lg bg-sunken p-3 text-[16px]"
          />
          <div className="mt-2 flex gap-2">
            <button disabled={pending || !correction.trim()} onClick={() => review("corrected", correction.trim())} className="h-8 rounded-full bg-accent px-3.5 text-[13px] text-accent-ink disabled:opacity-40">
              Save correction
            </button>
            <button onClick={() => setCorrecting(false)} className="h-8 px-3 text-[13px] text-ink-faint">
              Cancel
            </button>
          </div>
        </div>
      )}

      {!hideReview && !correcting && (
        <footer className="mt-4 flex flex-wrap gap-1.5 text-[12.5px]">
          {!isQuestion && (
            <>
              <button disabled={pending} onClick={() => review(o.status === "accepted" ? "pending" : "accepted")} aria-pressed={o.status === "accepted"} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-ink-soft hover:border-line-strong">
                <Check size={13} /> Rings true
              </button>
              <button disabled={pending} onClick={() => review(o.status === "rejected" ? "pending" : "rejected")} aria-pressed={o.status === "rejected"} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-ink-soft hover:border-line-strong">
                <X size={13} /> Not right
              </button>
              <button disabled={pending} onClick={() => setCorrecting(true)} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-ink-soft hover:border-line-strong">
                <PenLine size={13} /> Correct it
              </button>
            </>
          )}
          <button
            disabled={pending}
            onClick={() => start(async () => { await deleteObservation(o.id); setGone(true); })}
            aria-label="Remove"
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-ink-faint hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </footer>
      )}
    </article>
  );
}
