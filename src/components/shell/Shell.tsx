"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Feather, Library, MessageCircle, Plus, Sparkles } from "lucide-react";
import { ROOMS } from "@/lib/nav";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/types";
import { Mark } from "./Mark";
import { QuickCapture } from "./QuickCapture";
import { AmbientSound } from "./AmbientSound";

export function Shell({
  profile,
  pendingProposals,
  children,
}: {
  profile: Profile;
  pendingProposals: number;
  children: React.ReactNode;
}) {
  const [compass, setCompass] = useState(false);
  const [capture, setCapture] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setCompass(false);
  }, [pathname]);

  // Keyboard: ⌘K compass, ⌘J capture, "g" then a room key to jump.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCompass((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCapture(true);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (mod || e.altKey) return;
      if (e.key === "g") {
        const next = (ev: KeyboardEvent) => {
          const room = ROOMS.find((r) => r.key === ev.key);
          if (room) router.push(room.href);
          window.removeEventListener("keydown", next, true);
        };
        window.addEventListener("keydown", next, true);
        setTimeout(() => window.removeEventListener("keydown", next, true), 1200);
      }
    },
    [router],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const rooms = ROOMS.filter((r) => !r.module || profile.modules.includes(r.module));

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <button
            onClick={() => setCompass(true)}
            className="group -ml-2 flex items-center gap-3 rounded-full py-1.5 pl-2 pr-3 transition-colors hover:bg-raised/70"
            aria-label="Open the compass (⌘K)"
            aria-expanded={compass}
          >
            <Mark size={26} />
            <span className="hidden font-display text-[19px] text-ink-soft transition-colors group-hover:text-ink sm:inline">
              {profile.space_name}
            </span>
          </button>
          <div className="flex items-center gap-1">
            {pendingProposals > 0 && (
              <Link
                href="/memory#proposals"
                className="mr-1 rounded-full bg-accent-soft px-3 py-1 text-[12px] text-accent transition-colors hover:brightness-110"
              >
                {pendingProposals} to review
              </Link>
            )}
            <AmbientSound enabled={profile.sound} world={profile.ambient_world} />
            <button
              onClick={() => setCapture(true)}
              className="hidden h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
            >
              <Plus size={15} /> Capture <kbd className="ml-1 text-[11px] text-ink-faint">⌘J</kbd>
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 pb-28 sm:pb-16">{children}</main>

      {/* Mobile bar */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 backdrop-blur-xl sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2">
          {[
            { href: "/", label: "Home", icon: Sparkles },
            { href: "/talk", label: "Talk", icon: MessageCircle },
            { href: "capture", label: "Capture", icon: Plus },
            { href: "/garden", label: "Garden", icon: Library },
            { href: "/reflect", label: "Reflect", icon: Feather },
          ].map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const inner = (
              <span className={cn("flex flex-col items-center gap-1 py-1.5 text-[10.5px]", active ? "text-accent" : "text-ink-faint")}>
                {item.href === "capture" ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink">
                    <Icon size={19} />
                  </span>
                ) : (
                  <Icon size={20} strokeWidth={1.6} />
                )}
                {item.href !== "capture" && item.label}
              </span>
            );
            return (
              <li key={item.href} className="flex justify-center">
                {item.href === "capture" ? (
                  <button aria-label="Quick capture" onClick={() => setCapture(true)}>
                    {inner}
                  </button>
                ) : (
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Compass */}
      <AnimatePresence>
        {compass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-bg/92 backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Compass"
            onKeyDown={(e) => e.key === "Escape" && setCompass(false)}
          >
            <div className="pt-safe mx-auto flex min-h-full max-w-3xl flex-col px-6 pb-12 sm:px-10">
              <div className="flex h-16 items-center justify-between">
                <Mark size={26} />
                <button onClick={() => setCompass(false)} className="eyebrow rounded-full px-3 py-2 hover:text-ink" autoFocus>
                  Close · Esc
                </button>
              </div>
              <p className="eyebrow mt-10">The rooms of {profile.space_name}</p>
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {rooms.map((room, i) => {
                  const active = room.href === "/" ? pathname === "/" : pathname.startsWith(room.href);
                  return (
                    <motion.li
                      key={room.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * i, duration: 0.35 }}
                    >
                      <Link
                        href={room.href}
                        className="group flex items-baseline justify-between gap-6 py-4 sm:py-5"
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="flex items-baseline gap-4">
                          <span className={cn("display text-[30px] sm:text-[40px] transition-colors", active ? "text-accent" : "text-ink group-hover:text-accent")}>
                            {room.name}
                          </span>
                          <span className="hidden font-serif text-[15px] italic text-ink-faint sm:inline">{room.note}</span>
                        </span>
                        <kbd className="hidden text-[12px] text-ink-faint sm:inline">g {room.key}</kbd>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
              <p className="mt-8 text-[12px] text-ink-faint">⌘K compass · ⌘J capture · g + key to jump</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickCapture open={capture} onClose={() => setCapture(false)} />
    </div>
  );
}
