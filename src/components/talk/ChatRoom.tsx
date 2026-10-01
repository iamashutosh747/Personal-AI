"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Bookmark, BookOpen, Brain, Check, Copy, Square } from "lucide-react";
import type { ChatEvent } from "@/app/api/chat/route";
import { saveMessageAsMemory } from "@/lib/actions/memories";
import { cn } from "@/lib/cn";
import type { Conversation, Message } from "@/lib/types";
import { Markdown } from "@/components/ui/Markdown";
import { Dictation } from "@/components/ui/Dictation";
import { ProposalCard, type ProposalView } from "@/components/memory/ProposalCard";
import { ConversationMenu } from "./ConversationMenu";
import { MemorySettings } from "./MemorySettings";

export interface ContextLabel {
  title: string;
  source: "memory" | "journal" | "message";
  href: string;
}

interface ChatMessage {
  key: string;
  id?: string;
  role: "user" | "assistant";
  content: string;
  contextIds: string[];
  mode?: Conversation["memory_mode"];
  streaming?: boolean;
  error?: string;
  createdAt?: string;
  proposals: ProposalView[];
}

let keySeq = 0;
const nextKey = () => `m${++keySeq}`;

function fromRow(m: Message, mode: Conversation["memory_mode"]): ChatMessage {
  return {
    key: m.id,
    id: m.id,
    role: m.role,
    content: m.content,
    contextIds: [...m.context_memory_ids, ...m.context_entry_ids, ...m.context_message_ids],
    mode,
    createdAt: m.created_at,
    proposals: [],
  };
}

export function ChatRoom({
  conversation,
  initialMessages,
  initialProposals,
  initialLabels,
  memoryOptions,
  aiReady,
  offRecord = false,
}: {
  conversation: Conversation | null;
  initialMessages: Message[];
  initialProposals: (ProposalView & { created_at?: string })[];
  initialLabels: Record<string, ContextLabel>;
  memoryOptions: { id: string; title: string; kind: string; ai_access: boolean }[];
  aiReady: boolean;
  offRecord?: boolean;
}) {
  const [mode, setMode] = useState<Conversation["memory_mode"]>(conversation?.memory_mode ?? "all");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const list = initialMessages.map((m) => fromRow(m, conversation?.memory_mode ?? "all"));
    // Show pending suggestions under the reply that produced them.
    for (const p of initialProposals) {
      const created = p.created_at ?? "";
      const host = list.find((m) => m.role === "assistant" && (m.createdAt ?? "") >= created) ?? [...list].reverse().find((m) => m.role === "assistant");
      host?.proposals.push(p);
    }
    return list;
  });
  const [labels, setLabels] = useState(initialLabels);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoStarted = useRef(false);

  const scrollToEnd = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  useEffect(() => scrollToEnd(false), [scrollToEnd]);

  const send = useCallback(
    async (content?: string, opts: { recall?: boolean } = {}) => {
      if (streaming) return;
      const trimmed = content?.trim();
      const assistantKey = nextKey();
      const history = messages.filter((m) => !m.error && m.content).map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [
        ...prev,
        ...(trimmed ? [{ key: nextKey(), role: "user" as const, content: trimmed, contextIds: [], proposals: [] }] : []),
        { key: assistantKey, role: "assistant", content: "", contextIds: [], streaming: true, mode, proposals: [] },
      ]);
      setText("");
      setStreaming(true);
      requestAnimationFrame(() => scrollToEnd());

      const update = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.key === assistantKey ? fn(m) : m)));

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            offRecord
              ? { offRecord: true, text: trimmed, history, memoryMode: mode === "none" ? "none" : "all", recall: opts.recall }
              : { conversationId: conversation!.id, text: trimmed, recall: opts.recall },
          ),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          update((m) => ({ ...m, streaming: false, error: err.error ?? "Something went wrong." }));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as ChatEvent;
            if (event.type === "context") {
              setLabels((prev) => {
                const next = { ...prev };
                for (const it of event.items) {
                  next[it.id] ??= {
                    title: it.source === "message" ? `“${it.title}”` : it.title,
                    source: it.source as ContextLabel["source"],
                    href: it.source === "memory" ? `/garden/${it.id}` : it.source === "journal" ? `/reflect/${it.id}` : "/talk",
                  };
                }
                return next;
              });
              update((m) => ({ ...m, contextIds: event.items.map((i) => i.id), mode: event.mode }));
            } else if (event.type === "text") {
              update((m) => ({ ...m, content: m.content + event.text }));
            } else if (event.type === "proposal") {
              update((m) => ({ ...m, proposals: [...m.proposals, { ...event.proposal, target_title: event.proposal.target_memory_id ? labels[event.proposal.target_memory_id]?.title : null }] }));
            } else if (event.type === "done") {
              update((m) => ({ ...m, id: event.messageId, streaming: false }));
            } else if (event.type === "error") {
              update((m) => ({ ...m, streaming: false, error: event.message }));
            }
          }
        }
        update((m) => ({ ...m, streaming: false }));
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        update((m) => ({ ...m, streaming: false, error: aborted ? (m.content ? undefined : "Stopped.") : "The connection was interrupted." }));
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, messages, offRecord, conversation, mode, scrollToEnd, labels],
  );

  // A conversation started from the Sanctuary arrives with an unanswered message.
  useEffect(() => {
    if (autoStarted.current || !aiReady || offRecord) return;
    if (messages[messages.length - 1]?.role !== "user") return;
    // Deferred so a strict-mode remount cancels the first attempt instead of sending twice.
    const t = setTimeout(() => {
      autoStarted.current = true;
      void send();
    }, 0);
    return () => clearTimeout(t);
  }, [aiReady, offRecord, messages, send]);

  const lastAssistantStreaming = streaming && messages[messages.length - 1]?.streaming;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-5 sm:px-8">
      <header className="sticky top-16 z-20 -mx-5 flex items-center justify-between gap-3 bg-gradient-to-b from-bg via-bg/95 to-transparent px-5 pb-6 pt-3 sm:-mx-8 sm:px-8">
        <div className="min-w-0">
          {offRecord ? (
            <p className="display text-[24px]">Off the record</p>
          ) : (
            <ConversationTitle conversation={conversation!} />
          )}
          <button
            onClick={() => !offRecord && setSettingsOpen(true)}
            className={cn("mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint", !offRecord && "hover:text-ink-soft")}
          >
            <Brain size={12} />
            {offRecord
              ? "Nothing here is saved. Memories can still be read."
              : mode === "none"
                ? "Memory off for this conversation"
                : mode === "chosen"
                  ? "Only memories you chose"
                  : "Can draw on memories you’ve allowed"}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => send("What do you remember about me?", { recall: true })}
            disabled={streaming || !aiReady}
            className="hidden h-9 items-center rounded-full border border-line px-3.5 text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 sm:inline-flex"
          >
            What do you remember?
          </button>
          {offRecord ? (
            <button
              onClick={() => setMode(mode === "none" ? "all" : "none")}
              className="h-9 rounded-full px-3 text-[13px] text-ink-faint hover:bg-raised hover:text-ink"
            >
              {mode === "none" ? "Allow memories" : "Turn memory off"}
            </button>
          ) : (
            <ConversationMenu conversation={conversation!} onMemorySettings={() => setSettingsOpen(true)} />
          )}
        </div>
      </header>

      {!aiReady && (
        <div className="mt-6 rounded-2xl border border-line bg-raised p-5 text-[14px] leading-relaxed text-ink-soft">
          Claude isn’t connected yet. Add <code className="text-accent">ANTHROPIC_API_KEY</code> to your server environment and restart. Your
          messages are still saved.
        </div>
      )}

      <div className="flex-1 space-y-10 pb-48 pt-8" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 && (
          <div className="py-16 text-center">
            <p className="display text-[34px] text-ink-soft">{offRecord ? "Nothing said here will be kept." : "Begin wherever you are."}</p>
            <p className="mx-auto mt-3 max-w-md font-serif text-[16px] leading-relaxed text-ink-faint">
              {offRecord
                ? "This conversation lives only in this tab. Close it and it’s gone, from this device and from the database."
                : "There’s no right way to start. A thought, a worry, a question, a memory."}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.key} message={m} labels={labels} offRecord={offRecord} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-[68px] z-20 sm:bottom-0">
        <div className="mx-auto max-w-3xl px-5 pb-4 sm:px-8 sm:pb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send(text);
            }}
            className="flex items-end gap-2 rounded-[24px] border border-line-strong bg-raised/90 p-2 pl-4 shadow-[0_20px_60px_-25px_rgb(0_0_0/0.9)] backdrop-blur-xl focus-within:border-accent/40"
          >
            <label htmlFor="composer" className="sr-only">
              Message
            </label>
            <textarea
              id="composer"
              ref={inputRef}
              value={text}
              rows={1}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (text.trim()) void send(text);
                }
              }}
              placeholder={streaming ? "Claude is writing…" : "Write a message"}
              className="page-text field max-h-[220px] flex-1 resize-none bg-transparent py-2 text-[17px] placeholder:text-ink-faint"
            />
            <Dictation onText={(t) => setText((prev) => (prev ? `${prev.trimEnd()} ${t}` : t))} />
            {lastAssistantStreaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Stop"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-ink-soft hover:text-ink"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim() || streaming}
                aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-30"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </form>
        </div>
      </div>

      {!offRecord && conversation && (
        <MemorySettings
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          conversation={{ ...conversation, memory_mode: mode }}
          options={memoryOptions}
          onSaved={(m) => setMode(m)}
        />
      )}
    </div>
  );
}

function ConversationTitle({ conversation }: { conversation: Conversation }) {
  return <h1 className="display truncate text-[24px] leading-tight sm:text-[28px]">{conversation.title}</h1>;
}

function MessageView({ message, labels, offRecord }: { message: ChatMessage; labels: Record<string, ContextLabel>; offRecord: boolean }) {
  const [showContext, setShowContext] = useState(false);
  const [kept, setKept] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const sources = useMemo(() => message.contextIds.map((id) => ({ id, ...(labels[id] ?? { title: "A record you have since removed", source: "memory" as const, href: "" }) })), [message.contextIds, labels]);

  if (message.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group flex flex-col items-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-raised px-4 py-3 font-serif text-[16.5px] leading-relaxed text-ink">
          {message.content}
        </div>
        {message.id && !offRecord && (
          <KeepButton kept={kept} pending={pending} onKeep={() => start(async () => {
            const r = await saveMessageAsMemory(message.id!);
            if (r.ok && r.id) setKept(r.id);
          })} />
        )}
      </motion.div>
    );
  }

  const thinking = message.streaming && !message.content;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Claude
      </div>
      {thinking ? (
        <div className="flex items-center gap-3 py-2" role="status" aria-label="Claude is thinking">
          <span className="flex gap-1.5">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
            <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
          </span>
          <span className="font-serif text-[15px] italic text-ink-faint">thinking</span>
        </div>
      ) : (
        message.content && <Markdown>{message.content}</Markdown>
      )}
      {message.error && (
        <p role="alert" className="mt-2 text-[13.5px] text-danger">
          {message.error}
        </p>
      )}

      {!message.streaming && message.content && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-faint">
          {message.mode === "none" ? (
            <span>Memory was off</span>
          ) : (
            <button onClick={() => setShowContext((v) => !v)} aria-expanded={showContext} className="flex items-center gap-1.5 hover:text-ink-soft">
              <BookOpen size={12} />
              {sources.length === 0 ? "No saved records used" : `Drew on ${sources.length} record${sources.length === 1 ? "" : "s"}`}
            </button>
          )}
          <button
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-1 opacity-70 hover:text-ink-soft hover:opacity-100"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
          {message.id && !offRecord && (
            <KeepButton inline kept={kept} pending={pending} onKeep={() => start(async () => {
              const r = await saveMessageAsMemory(message.id!);
              if (r.ok && r.id) setKept(r.id);
            })} />
          )}
        </div>
      )}

      <AnimatePresence>
        {showContext && sources.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1.5 overflow-hidden border-l border-line pl-4"
          >
            {sources.map((s) => (
              <li key={s.id} className="text-[13px]">
                <span className="mr-2 text-[11px] uppercase tracking-wider text-ink-faint">
                  {s.source === "memory" ? "Memory" : s.source === "journal" ? "Journal" : "Past conversation"}
                </span>
                {s.href ? (
                  <Link href={s.href} className="text-ink-soft underline-offset-4 hover:text-accent hover:underline">
                    {s.title}
                  </Link>
                ) : (
                  <span className="italic text-ink-faint">{s.title}</span>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {message.proposals.length > 0 && (
        <div className="mt-5 space-y-3">
          {message.proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} compact />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function KeepButton({ kept, pending, onKeep, inline }: { kept: string | null; pending: boolean; onKeep: () => void; inline?: boolean }) {
  if (kept) {
    return (
      <Link href={`/garden/${kept}`} className={cn("flex items-center gap-1 text-[12px] text-ok", !inline && "mt-1.5")}>
        <Check size={12} /> Kept as a memory
      </Link>
    );
  }
  return (
    <button
      onClick={onKeep}
      disabled={pending}
      className={cn(
        "flex items-center gap-1 text-[12px] text-ink-faint transition-opacity hover:text-ink-soft",
        !inline && "mt-1.5 opacity-0 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-60",
      )}
    >
      <Bookmark size={12} /> {pending ? "Keeping…" : "Keep as memory"}
    </button>
  );
}

