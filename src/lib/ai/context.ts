import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed, toPgVector } from "@/lib/memory/embeddings";
import { MEMORY_COLUMNS, type Memory, type RetrievedItem, type SelfAttribute } from "@/lib/types";

export type MemoryMode = "all" | "chosen" | "none";

export interface GatheredContext {
  items: RetrievedItem[];
  attributes: Pick<SelfAttribute, "id" | "kind" | "label" | "detail">[];
  /** The text of the per-turn system message. */
  block: string;
}

const RECALL_PATTERN =
  /\bwhat (do|did|can) you (remember|recall|know) about me\b|\bwhat have i (told|shared with) you\b|\bwhat('s| is) in your memory\b/i;

export function isRecallRequest(text: string) {
  return RECALL_PATTERN.test(text);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attr(s: string) {
  return esc(s).replace(/"/g, "&quot;");
}

export function formatContext(
  items: RetrievedItem[],
  attributes: GatheredContext["attributes"],
  opts: { mode: MemoryMode; recall: boolean; today: string },
): string {
  if (opts.mode === "none") {
    return `<context>\nMemory is switched off for this conversation. You have no access to their saved memories, journal or past conversations here. If they refer to something from before, ask them about it.\n</context>`;
  }
  const lines: string[] = [`<context today="${opts.today}">`];
  lines.push(
    opts.recall
      ? "They asked what you remember. Below is everything the app makes available to you in this conversation. Answer only from it, group it sensibly, and tell them they can review, correct or remove any of it in the Memory Ledger."
      : "Records from their own Inner World that may relate to this message, retrieved by search. Use them only where they genuinely help, and do not list them back unprompted. They are the person's own words or saved notes.",
  );
  if (attributes.length) {
    lines.push("<self_description note=\"how they describe themselves in The Mirror\">");
    for (const a of attributes) lines.push(`- [${a.kind}] ${esc(a.label)}${a.detail ? `: ${esc(a.detail)}` : ""}`);
    lines.push("</self_description>");
  }
  for (const it of items) {
    const date = it.occurred_on ?? it.created_at.slice(0, 10);
    if (it.source === "memory") {
      const tags = it.tags.length ? ` tags="${attr(it.tags.join(", "))}"` : "";
      lines.push(`<memory id="${it.id}" kind="${it.kind}" date="${date}" title="${attr(it.title)}"${tags}>${esc(it.body)}</memory>`);
    } else if (it.source === "journal") {
      lines.push(`<journal_entry id="${it.id}" date="${date}" title="${attr(it.title)}">${esc(it.body)}</journal_entry>`);
    } else {
      lines.push(
        `<past_message id="${it.id}" speaker="${it.kind === "user" ? "them" : "you (an earlier conversation)"}" conversation="${attr(it.title)}" date="${date}">${esc(it.body)}</past_message>`,
      );
    }
  }
  if (!items.length && !attributes.length) {
    lines.push(
      opts.recall
        ? "There are no saved memories available to you. Tell them so honestly, and that they can add memories in the Memory Garden."
        : "No saved records matched this message.",
    );
  }
  lines.push("</context>");
  return lines.join("\n");
}

export async function gatherContext(
  supabase: SupabaseClient,
  opts: {
    query: string;
    mode: MemoryMode;
    chosen: string[];
    conversationId?: string;
    recall: boolean;
    neverShareTags: string[];
    today: string;
  },
): Promise<GatheredContext> {
  if (opts.mode === "none") {
    return { items: [], attributes: [], block: formatContext([], [], { mode: "none", recall: opts.recall, today: opts.today }) };
  }

  let items: RetrievedItem[] = [];
  let attributes: GatheredContext["attributes"] = [];

  if (opts.mode === "all") {
    const { data } = await supabase
      .from("self_attributes")
      .select("id,kind,label,detail")
      .is("until", null)
      .eq("ai_access", true)
      .order("kind")
      .limit(40);
    attributes = data ?? [];
  }

  if (opts.recall && opts.mode === "all") {
    // Everything visible to the AI, newest and most important first.
    const { data } = await supabase
      .from("memories")
      .select(MEMORY_COLUMNS)
      .eq("ai_access", true)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60)
      .returns<Memory[]>();
    items = (data ?? [])
      .filter((m) => !m.tags.some((t) => opts.neverShareTags.includes(t)))
      .map((m) => ({
        source: "memory" as const,
        id: m.id,
        kind: m.kind,
        title: m.title,
        body: m.body.slice(0, 1200),
        occurred_on: m.occurred_on,
        created_at: m.created_at,
        tags: m.tags,
        score: 1,
      }));
  } else {
    const vector = opts.mode === "all" ? await embed(opts.query, "query") : null;
    const { data, error } = await supabase.rpc("retrieve_context", {
      p_query: opts.query.slice(0, 2000),
      p_embedding: vector ? toPgVector(vector) : null,
      p_memory_mode: opts.mode,
      p_chosen: opts.chosen,
      p_exclude_conversation: opts.conversationId ?? null,
      p_limit: opts.mode === "chosen" ? 20 : 8,
    });
    if (!error && data) {
      items = (data as RetrievedItem[]).map((it) => ({ ...it, body: it.body.slice(0, 1500) }));
    }
  }

  return { items, attributes, block: formatContext(items, attributes, { mode: opts.mode, recall: opts.recall, today: opts.today }) };
}
