"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea, Toggle } from "@/components/ui/Field";
import { Mark } from "@/components/shell/Mark";
import { completeOnboarding } from "@/lib/actions/profile";
import { cn } from "@/lib/cn";
import {
  CONVERSATION_STYLES,
  CONVERSATION_STYLE_LABELS,
  WORLDS,
  WORLD_LABELS,
  type ConversationStyle,
  type Profile,
  type World,
} from "@/lib/types";

const MODULES = [
  { id: "talk", name: "Conversations", note: "Think out loud with an AI that can remember what you allow." },
  { id: "garden", name: "Memory Garden", note: "Keep experiences, ideas, photos and voices." },
  { id: "reflect", name: "Reflection Room", note: "A quiet place to write." },
  { id: "mirror", name: "The Mirror", note: "Describe yourself, and watch it change." },
  { id: "capsules", name: "Time Capsules", note: "Letters that wait for the right day." },
];

const STEPS = ["space", "voice", "rooms", "atmosphere", "memory", "privacy"] as const;

export function Onboarding({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [spaceName, setSpaceName] = useState(profile.space_name);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [style, setStyle] = useState<ConversationStyle>(profile.conversation_style);
  const [modules, setModules] = useState<string[]>(profile.modules);
  const [world, setWorld] = useState<World>(profile.ambient_world);
  const [motionOn, setMotionOn] = useState(profile.motion);
  const [sound, setSound] = useState(profile.sound);
  const [autoWorld, setAutoWorld] = useState(profile.auto_world);
  const [startWith, setStartWith] = useState<"empty" | "import">("empty");
  const [importNotes, setImportNotes] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [defaultAi, setDefaultAi] = useState(profile.default_ai_access);
  const [journalAi, setJournalAi] = useState(profile.journal_ai_access);
  const [neverTags, setNeverTags] = useState(profile.never_share_tags.join(", "));

  // Preview the chosen world live.
  useEffect(() => {
    document.documentElement.dataset.world = world;
    document.documentElement.dataset.motion = motionOn ? "on" : "off";
  }, [world, motionOn]);

  function finish() {
    setError(null);
    start(async () => {
      const res = await completeOnboarding({
        profile: {
          space_name: spaceName.trim() || "The Inner World",
          display_name: displayName,
          conversation_style: style,
          modules,
          ambient_world: world,
          motion: motionOn,
          sound,
          auto_world: autoWorld,
          default_ai_access: defaultAi,
          journal_ai_access: journalAi,
          never_share_tags: neverTags,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        importNotes: startWith === "import" ? importNotes : "",
        aboutMe,
      });
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.replace("/");
    });
  }

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col px-6 pb-10 pt-safe sm:px-10">
      <div className="flex h-20 items-center justify-between">
        <Mark size={30} />
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-1 w-6 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line-strong")} />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <AnimatePresence mode="wait">
          <motion.section
            key={current}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {current === "space" && (
              <>
                <p className="eyebrow">Welcome</p>
                <h1 className="display mt-4 text-[44px] sm:text-[56px]">This space is yours.</h1>
                <p className="mt-4 font-serif text-[18px] leading-relaxed text-ink-soft">
                  A few questions to set the room. Every one of them can be skipped and changed later in Settings.
                </p>
                <div className="mt-10 grid gap-8 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="space">What should we call this place?</Label>
                    <Input id="space" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="name" hint="optional">What should it call you?</Label>
                    <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} placeholder="Your name" />
                  </div>
                </div>
              </>
            )}

            {current === "voice" && (
              <>
                <p className="eyebrow">Conversation</p>
                <h1 className="display mt-4 text-[44px]">How would you like to be talked with?</h1>
                <div className="mt-8 space-y-2" role="radiogroup">
                  {CONVERSATION_STYLES.map((s) => (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={style === s}
                      onClick={() => setStyle(s)}
                      className={cn(
                        "block w-full rounded-2xl border px-5 py-4 text-left text-[15px] transition-colors",
                        style === s ? "border-accent/60 bg-accent-soft text-ink" : "border-line text-ink-soft hover:border-line-strong",
                      )}
                    >
                      {CONVERSATION_STYLE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </>
            )}

            {current === "rooms" && (
              <>
                <p className="eyebrow">Rooms</p>
                <h1 className="display mt-4 text-[44px]">Which rooms interest you?</h1>
                <p className="mt-3 font-serif text-[17px] text-ink-soft">Unchosen rooms stay out of your way. You can open them any time.</p>
                <div className="mt-8 space-y-2">
                  {MODULES.map((m) => {
                    const on = modules.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        aria-pressed={on}
                        onClick={() => setModules(on ? modules.filter((x) => x !== m.id) : [...modules, m.id])}
                        className={cn(
                          "flex w-full items-baseline justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors",
                          on ? "border-accent/60 bg-accent-soft" : "border-line hover:border-line-strong",
                        )}
                      >
                        <span className="display text-[24px]">{m.name}</span>
                        <span className="text-right text-[13px] text-ink-faint">{m.note}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {current === "atmosphere" && (
              <>
                <p className="eyebrow">Atmosphere</p>
                <h1 className="display mt-4 text-[44px]">Choose the light.</h1>
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {WORLDS.map((w) => (
                    <button
                      key={w}
                      data-world={w}
                      onClick={() => setWorld(w)}
                      aria-pressed={world === w}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border p-4 text-left transition-all",
                        world === w ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong",
                      )}
                      style={{ background: "radial-gradient(circle at 20% 0%, var(--glow-a), transparent 60%), var(--bg)" }}
                    >
                      <span className="block h-10" />
                      <span className="display block text-[19px] text-ink">{WORLD_LABELS[w].name}</span>
                      <span className="mt-0.5 block text-[12px] text-ink-faint">{WORLD_LABELS[w].note}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 divide-y divide-line">
                  <Toggle checked={autoWorld} onChange={setAutoWorld} label="Let the light follow the clock" description="Golden hour at dusk, a library at night, stars before dawn." />
                  <Toggle checked={motionOn} onChange={setMotionOn} label="Gentle motion" description="Slow drifting light. Your device's reduced-motion setting always wins." />
                  <Toggle checked={sound} onChange={setSound} label="Ambient sound available" description="Adds a play button. Sound never starts on its own." />
                </div>
              </>
            )}

            {current === "memory" && (
              <>
                <p className="eyebrow">Memory</p>
                <h1 className="display mt-4 text-[44px]">Start empty, or bring a few notes?</h1>
                <div className="mt-8 flex gap-2">
                  {(["empty", "import"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setStartWith(v)}
                      aria-pressed={startWith === v}
                      className={cn(
                        "rounded-full px-4 py-2 text-[14px] transition-colors",
                        startWith === v ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink-soft",
                      )}
                    >
                      {v === "empty" ? "Start empty" : "Import some notes"}
                    </button>
                  ))}
                </div>
                {startWith === "import" && (
                  <div className="mt-6">
                    <Label htmlFor="notes" hint="paste text; a blank line separates memories">Notes</Label>
                    <Textarea id="notes" rows={7} value={importNotes} onChange={(e) => setImportNotes(e.target.value)} className="page-text" />
                    <p className="mt-2 text-[12px] text-ink-faint">Nothing is imported from other accounts. Only what you paste here.</p>
                  </div>
                )}
                <div className="mt-8">
                  <Label htmlFor="about" hint="optional">Anything the AI should know about how you’d like to be met?</Label>
                  <Textarea
                    id="about"
                    rows={3}
                    value={aboutMe}
                    onChange={(e) => setAboutMe(e.target.value)}
                    placeholder="e.g. I think best when someone pushes back a little. I'm a designer in Lisbon."
                    className="page-text"
                  />
                  <p className="mt-2 text-[12px] text-ink-faint">Saved as a visible, editable preference in your Memory Garden.</p>
                </div>
              </>
            )}

            {current === "privacy" && (
              <>
                <p className="eyebrow">Privacy</p>
                <h1 className="display mt-4 text-[44px]">What may the AI read?</h1>
                <p className="mt-3 font-serif text-[17px] leading-relaxed text-ink-soft">
                  Conversations are processed by Anthropic’s Claude API. Your data is stored in your own Supabase project. Nothing is shared or
                  used for advertising.
                </p>
                <div className="mt-6 divide-y divide-line">
                  <Toggle
                    checked={defaultAi}
                    onChange={setDefaultAi}
                    label="New memories are available to the AI"
                    description="You can still mark any memory private, one by one."
                  />
                  <Toggle
                    checked={journalAi}
                    onChange={setJournalAi}
                    label="Journal entries are available to the AI"
                    description="Off by default. Unfiltered entries are never sent unless you ask."
                  />
                </div>
                <div className="mt-6">
                  <Label htmlFor="never" hint="comma separated">Tags that always stay private</Label>
                  <Input id="never" value={neverTags} onChange={(e) => setNeverTags(e.target.value)} placeholder="health, family" />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {error && <p className="mb-4 text-[13px] text-danger">{error}</p>}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => (step === 0 ? finish() : setStep(step - 1))} disabled={pending}>
          {step === 0 ? "Skip all" : "Back"}
        </Button>
        <div className="flex gap-2">
          {!last && (
            <Button variant="ghost" onClick={() => setStep(step + 1)} disabled={pending}>
              Skip
            </Button>
          )}
          <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))} disabled={pending}>
            {last ? (pending ? "Opening the door…" : "Enter") : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
