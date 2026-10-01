"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { World } from "@/lib/types";

/**
 * Generated ambient sound (Web Audio), so no audio files are downloaded.
 * Off until you press play; never starts on its own.
 */
export function AmbientSound({ enabled, world }: { enabled: boolean; world: World }) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);
  useEffect(() => {
    if (!enabled && playing) {
      stopRef.current?.();
      setPlaying(false);
    }
  }, [enabled, playing]);

  if (!enabled) return null;

  function start() {
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume();
    stopRef.current = soundscape(ctx, world);
    setPlaying(true);
  }

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
  }

  return (
    <button
      onClick={playing ? stop : start}
      aria-label={playing ? "Stop ambient sound" : "Play ambient sound"}
      aria-pressed={playing}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-raised hover:text-ink"
    >
      {playing ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}

function noiseBuffer(ctx: AudioContext, kind: "brown" | "pink") {
  const len = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
      }
    }
  }
  return buffer;
}

function soundscape(ctx: AudioContext, world: World): () => void {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);

  const nodes: AudioScheduledSourceNode[] = [];
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, world === "rainy-window" ? "pink" : "brown");
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = world === "rainy-window" ? "highpass" : "lowpass";
  filter.frequency.value = world === "rainy-window" ? 900 : world === "deep-forest" ? 700 : 420;
  const gain = ctx.createGain();
  gain.gain.value = world === "rainy-window" ? 0.35 : 0.5;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  nodes.push(src);

  // A low, slow drone for the night worlds.
  if (world === "midnight-library" || world === "quiet-observatory" || world === "golden-hour") {
    const base = world === "quiet-observatory" ? 110 : world === "golden-hour" ? 98 : 82.4;
    for (const mult of [1, 1.5, 2.01]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = 0.018 / mult;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + mult * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.01 / mult;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(master);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    }
  }

  return () => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => {
      nodes.forEach((n) => n.stop());
      master.disconnect();
    }, 900);
  };
}
