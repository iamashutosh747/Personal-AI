"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function SummaryControls() {
  const [includePrivate, setIncludePrivate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (period: "week" | "month") =>
    start(async () => {
      setMessage(null);
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "summary", period, includePrivate }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; created?: number };
      if (!res.ok) setMessage(json.error ?? "Something went wrong.");
      else {
        setMessage(json.created ? null : "Nothing well-grounded enough to say yet.");
        router.refresh();
      }
    });

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => run(p)}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-dashed border-accent-2/50 px-4 text-[13px] text-accent-2 transition-colors hover:bg-accent-2/10 disabled:opacity-50"
          >
            <Sparkles size={13} /> {pending ? "Reading…" : `Reflect on this ${p}`}
          </button>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-faint">
        <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} className="accent-[var(--accent)]" />
        Include entries not marked for AI, just this once (Unfiltered entries are never sent)
      </label>
      {message && <p className="mt-3 text-[13px] text-ink-soft">{message}</p>}
    </div>
  );
}
