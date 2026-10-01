"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/profile";
import {
  CONVERSATION_STYLES,
  CONVERSATION_STYLE_LABELS,
  MEMORY_KINDS,
  MEMORY_KIND_LABELS,
  WORLDS,
  WORLD_LABELS,
  type Profile,
} from "@/lib/types";
import { Input, Label, Select, Toggle } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const MODULES = [
  ["talk", "Conversations"],
  ["garden", "Memory Garden"],
  ["reflect", "Reflection Room"],
  ["mirror", "The Mirror"],
  ["capsules", "Time Capsules"],
] as const;

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [status, setStatus] = useState<string | null>(null);
  const [, start] = useTransition();

  function save(patch: Partial<Profile>) {
    const next = { ...p, ...patch };
    setP(next);
    if (patch.ambient_world) document.documentElement.dataset.world = patch.ambient_world;
    if (typeof patch.motion === "boolean") document.documentElement.dataset.motion = patch.motion ? "on" : "off";
    start(async () => {
      const res = await updateProfile(patch as Record<string, unknown>);
      setStatus(res.ok ? "Saved" : res.error ?? "Not saved");
      if (res.ok) router.refresh();
      setTimeout(() => setStatus(null), 1800);
    });
  }

  const section = "mt-14 first:mt-0";
  return (
    <div>
      <p aria-live="polite" className="fixed bottom-24 right-6 z-40 rounded-full bg-raised px-4 py-2 text-[12.5px] text-ink-soft shadow-xl transition-opacity sm:bottom-6" style={{ opacity: status ? 1 : 0 }}>
        {status}
      </p>

      <section className={section}>
        <h2 className="display text-[30px]">Personal</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <Label htmlFor="space">Name of this place</Label>
            <Input id="space" defaultValue={p.space_name} maxLength={80} onBlur={(e) => e.target.value.trim() && e.target.value !== p.space_name && save({ space_name: e.target.value.trim() })} />
          </div>
          <div>
            <Label htmlFor="dn">What it calls you</Label>
            <Input id="dn" defaultValue={p.display_name ?? ""} maxLength={80} onBlur={(e) => e.target.value !== (p.display_name ?? "") && save({ display_name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="style">Conversation style</Label>
            <Select id="style" value={p.conversation_style} onChange={(e) => save({ conversation_style: e.target.value as Profile["conversation_style"] })}>
              {CONVERSATION_STYLES.map((s) => (
                <option key={s} value={s}>
                  {CONVERSATION_STYLE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-8">
          <Label>Rooms in the Compass</Label>
          <div className="flex flex-wrap gap-2">
            {MODULES.map(([id, name]) => {
              const on = p.modules.includes(id);
              return (
                <button
                  key={id}
                  aria-pressed={on}
                  onClick={() => save({ modules: on ? p.modules.filter((m) => m !== id) : [...p.modules, id] })}
                  className={cn("rounded-full px-3.5 py-1.5 text-[13px]", on ? "bg-accent-soft text-accent" : "border border-line text-ink-faint")}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={section}>
        <h2 className="display text-[30px]">Atmosphere</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WORLDS.map((w) => (
            <button
              key={w}
              data-world={w}
              onClick={() => save({ ambient_world: w })}
              aria-pressed={p.ambient_world === w}
              className={cn("rounded-2xl border p-4 text-left", p.ambient_world === w ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong")}
              style={{ background: "radial-gradient(circle at 20% 0%, var(--glow-a), transparent 60%), var(--bg)" }}
            >
              <span className="block h-8" />
              <span className="display block text-[18px] text-ink">{WORLD_LABELS[w].name}</span>
              <span className="block text-[11.5px] text-ink-faint">{WORLD_LABELS[w].note}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 divide-y divide-line">
          <Toggle checked={p.auto_world} onChange={(v) => save({ auto_world: v })} label="Let the light follow the clock" description="Changes with the time of day, never with your mood." />
          <Toggle checked={p.motion} onChange={(v) => save({ motion: v })} label="Gentle motion" description="Your device’s reduced-motion setting always takes precedence." />
          <Toggle checked={p.sound} onChange={(v) => save({ sound: v })} label="Ambient sound" description="Shows a play button in the header. Generated in your browser; never autoplays." />
        </div>
      </section>

      <section className={section}>
        <h2 className="display text-[30px]">Privacy & the AI</h2>
        <div className="mt-4 divide-y divide-line">
          <Toggle checked={p.default_ai_access} onChange={(v) => save({ default_ai_access: v })} label="New memories are available to the AI" description="Applies to memories created from now on. Each memory can still be changed individually." />
          <Toggle checked={p.journal_ai_access} onChange={(v) => save({ journal_ai_access: v })} label="New journal entries may be recalled in conversations" description="Unfiltered entries are always private." />
        </div>
        <div className="mt-6">
          <Label htmlFor="never" hint="comma separated">Tags that are never shared with the AI</Label>
          <Input id="never" defaultValue={p.never_share_tags.join(", ")} onBlur={(e) => save({ never_share_tags: e.target.value as unknown as string[] })} placeholder="health, family" />
        </div>
      </section>

      <section className={section}>
        <h2 className="display text-[30px]">A Moment From Then</h2>
        <p className="mt-2 text-[14px] text-ink-faint">How often an older memory is waiting on your Sanctuary, and which kinds.</p>
        <div className="mt-5 flex gap-2">
          {(["daily", "weekly", "off"] as const).map((f) => (
            <button key={f} aria-pressed={p.rediscovery_frequency === f} onClick={() => save({ rediscovery_frequency: f })} className={cn("rounded-full px-3.5 py-1.5 text-[13px]", p.rediscovery_frequency === f ? "bg-accent-soft text-accent" : "border border-line text-ink-faint")}>
              {f === "off" ? "Never" : f === "daily" ? "A new one each day" : "One each week"}
            </button>
          ))}
        </div>
        {p.rediscovery_frequency !== "off" && (
          <div className="mt-5 flex flex-wrap gap-2">
            {[...MEMORY_KINDS.filter((k) => k !== "preference" && k !== "other"), "conversation" as const].map((k) => {
              const on = p.rediscovery_kinds.includes(k);
              return (
                <button key={k} aria-pressed={on} onClick={() => save({ rediscovery_kinds: on ? p.rediscovery_kinds.filter((x) => x !== k) : [...p.rediscovery_kinds, k] })} className={cn("rounded-full px-3 py-1 text-[12.5px]", on ? "bg-accent-soft text-accent" : "border border-line text-ink-faint")}>
                  {k === "conversation" ? "Kept conversations" : MEMORY_KIND_LABELS[k]}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
