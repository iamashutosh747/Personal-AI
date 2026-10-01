"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { openCapsule } from "@/lib/actions/capsules";
import type { Capsule, Media } from "@/lib/types";
import { formatDate } from "@/lib/time";
import { MediaGallery } from "@/components/garden/MediaTools";
import { Seal } from "./Seal";

export function CapsuleOpening({ capsule, media, memories }: { capsule: Capsule; media: Media[]; memories: { id: string; title: string }[] }) {
  const [letter, setLetter] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setOpening(true);
    const res = await openCapsule(capsule.id);
    if (!res.ok) {
      setError(res.error);
      setOpening(false);
      return;
    }
    // Let the seal break before the letter appears.
    setTimeout(() => setLetter(res.capsule.letter), 900);
  }

  return (
    <AnimatePresence mode="wait">
      {letter === null ? (
        <motion.div key="sealed" exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }} transition={{ duration: 0.8 }} className="flex flex-col items-center py-20 text-center">
          <motion.div animate={opening ? { rotate: [0, -6, 8, 0], scale: [1, 1.08, 0.9] } : {}} transition={{ duration: 0.9 }}>
            <Seal size={120} broken={opening} />
          </motion.div>
          <p className="eyebrow mt-10 !text-accent">Its day has come</p>
          <h1 className="display mt-4 text-[46px] leading-tight">{capsule.title}</h1>
          <p className="mt-3 font-serif text-[17px] text-ink-soft">You sealed this on {formatDate(capsule.sealed_at)}.</p>
          <button
            onClick={open}
            disabled={opening}
            className="mt-12 h-12 rounded-full bg-accent px-8 text-[15px] font-medium text-accent-ink shadow-[0_0_40px_-8px_var(--accent)] transition-[filter] hover:brightness-110 disabled:opacity-70"
          >
            {opening ? "Opening…" : "Break the seal"}
          </button>
          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
        </motion.div>
      ) : (
        <motion.div key="letter" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}>
          <CapsuleLetter capsule={{ ...capsule, opened_at: new Date().toISOString() }} letter={letter} media={media} memories={memories} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The letter exactly as it was written. Nothing here is generated or rewritten. */
export function CapsuleLetter({ capsule, letter, media, memories }: { capsule: Capsule; letter: string; media: Media[]; memories: { id: string; title: string }[] }) {
  return (
    <article className="pb-16 pt-10">
      <p className="eyebrow">
        Written {formatDate(capsule.sealed_at)} · opened {formatDate(capsule.opened_at)}
      </p>
      <h1 className="display mt-4 text-[44px] leading-tight sm:text-[54px]">{capsule.title}</h1>
      <div className="mt-8 rounded-[28px] border border-line bg-[color-mix(in_oklab,var(--ink)_3%,var(--bg))] p-6 sm:p-12">
        <p className="page-text whitespace-pre-wrap text-[19px]">{letter}</p>
      </div>
      {capsule.goals.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow">What you were hoping for</h2>
          <ul className="mt-4 space-y-2 font-serif text-[18px] text-ink-soft">
            {capsule.goals.map((g, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-accent">·</span> {g}
              </li>
            ))}
          </ul>
        </section>
      )}
      {media.length > 0 && (
        <section className="mt-12">
          <MediaGallery items={media} readOnly />
        </section>
      )}
      {memories.length > 0 && (
        <section className="mt-12">
          <h2 className="eyebrow">Memories you sent forward</h2>
          <ul className="mt-4 space-y-1.5">
            {memories.map((m) => (
              <li key={m.id}>
                <Link href={`/garden/${m.id}`} className="font-display text-[22px] text-ink-soft hover:text-accent">
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
