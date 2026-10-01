"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/cn";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Voice-to-text using the browser's own speech recognition (Chrome, Edge,
 * Safari). Where it isn't available, the button explains the alternative
 * instead of failing silently.
 */
export function Dictation({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => rec.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) {
      setNote("Voice typing isn't available in this browser. Your keyboard's dictation key works everywhere.");
      return;
    }
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript;
      }
      if (finalText.trim()) onTextRef.current(finalText.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") setNote("Microphone access was blocked. You can allow it in your browser settings.");
    };
    rec.current = r;
    setNote(null);
    r.start();
    setListening(true);
  }

  if (supported === false && !note) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Voice typing unavailable"
        className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-faint/60", className)}
      >
        <MicOff size={17} />
      </button>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? "Stop voice typing" : "Voice typing"}
        aria-pressed={listening}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          listening ? "bg-accent-soft text-accent" : "text-ink-faint hover:bg-raised hover:text-ink",
          className,
        )}
      >
        <Mic size={17} />
        {listening && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-danger" />}
      </button>
      {note && (
        <span role="status" className="absolute bottom-11 right-0 z-20 w-64 rounded-xl border border-line bg-raised p-3 text-[12px] leading-snug text-ink-soft shadow-xl">
          {note}
        </span>
      )}
    </span>
  );
}
