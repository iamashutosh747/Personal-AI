import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getSession } from "@/lib/supabase/server";
import { aiConfigured, claude, describeAiError, fallbackOptions } from "@/lib/ai/client";
import { systemPrompt } from "@/lib/ai/persona";
import { gatherContext, isRecallRequest, type MemoryMode } from "@/lib/ai/context";
import { MEMORY_TOOLS, runMemoryTool, type ProposalEvent } from "@/lib/ai/tools";
import { serverEnv } from "@/lib/env";
import { todayIn } from "@/lib/time";
import { MESSAGE_COLUMNS, type Conversation, type Message, type Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const body = z.object({
  conversationId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(20000).optional(),
  recall: z.boolean().optional(),
  offRecord: z.boolean().optional(),
  // Off-the-record threads keep their history in the browser only.
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(100000) }))
    .max(200)
    .optional(),
  memoryMode: z.enum(["all", "none"]).optional(),
});

export type ChatEvent =
  | { type: "start"; userMessageId?: string }
  | { type: "context"; items: { id: string; source: string; title: string }[]; attributes: number; mode: MemoryMode }
  | { type: "text"; text: string }
  | { type: "proposal"; proposal: ProposalEvent }
  | { type: "done"; messageId?: string; model: string; stopReason: string | null }
  | { type: "error"; message: string };

const HISTORY_CHAR_BUDGET = 150_000;
const MAX_TOOL_ROUNDS = 4;

function trimHistory(rows: { role: "user" | "assistant"; content: string }[]) {
  let total = 0;
  const out: typeof rows = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    total += rows[i]!.content.length;
    if (total > HISTORY_CHAR_BUDGET && out.length > 0) break;
    out.unshift(rows[i]!);
  }
  while (out.length && out[0]!.role !== "user") out.shift();
  return out;
}

export async function POST(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;

  if (!aiConfigured()) {
    return Response.json(
      { error: "Claude is not connected yet. Add ANTHROPIC_API_KEY to the server environment (see README)." },
      { status: 503 },
    );
  }

  const { data: allowed } = await supabase.rpc("consume_ai_quota", {
    p_kind: "chat",
    p_per_minute: serverEnv.chatPerMinute,
    p_per_day: serverEnv.chatPerDay,
  });
  if (!allowed) {
    return Response.json({ error: "You've reached the conversation limit for now. Take a breath and try again shortly." }, { status: 429 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) return Response.json({ error: "Profile missing" }, { status: 400 });

  // ── Assemble the conversation
  let conversation: Conversation | null = null;
  let history: { role: "user" | "assistant"; content: string }[] = [];
  let userMessageId: string | undefined;
  let mode: MemoryMode = "all";
  let chosen: string[] = [];

  if (input.offRecord) {
    if (!input.text) return Response.json({ error: "Say something first" }, { status: 400 });
    history = [...(input.history ?? []), { role: "user", content: input.text }];
    mode = input.memoryMode ?? "all";
  } else {
    if (!input.conversationId) return Response.json({ error: "Missing conversation" }, { status: 400 });
    const { data: convo } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", input.conversationId)
      .maybeSingle<Conversation>();
    if (!convo) return Response.json({ error: "Conversation not found" }, { status: 404 });
    conversation = convo;
    mode = convo.memory_mode;
    chosen = convo.chosen_memory_ids;

    if (input.text) {
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({ conversation_id: convo.id, role: "user", content: input.text })
        .select("id")
        .single();
      if (error || !inserted) return Response.json({ error: "Could not save your message" }, { status: 500 });
      userMessageId = inserted.id;
    }
    const { data: rows } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", convo.id)
      .order("created_at")
      .returns<Message[]>();
    history = (rows ?? []).map((m) => ({ role: m.role, content: m.content }));
    if (!history.length || history[history.length - 1]!.role !== "user") {
      return Response.json({ error: "Nothing to reply to" }, { status: 400 });
    }
  }

  history = trimHistory(history);
  const lastUser = history[history.length - 1]!.content;
  const previousUser = [...history].reverse().filter((m) => m.role === "user")[1]?.content ?? "";
  const recall = Boolean(input.recall) || isRecallRequest(lastUser);

  const context = await gatherContext(supabase, {
    query: `${lastUser}\n${previousUser.slice(0, 400)}`,
    mode,
    chosen,
    conversationId: conversation?.id,
    recall,
    neverShareTags: profile.never_share_tags,
    today: todayIn(profile.timezone),
  });

  // Stable prefix (system prompt + history) first, then the per-turn context
  // as a mid-conversation system message, so earlier turns stay cacheable.
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) =>
    i === history.length - 1
      ? { role: m.role, content: [{ type: "text", text: m.content, cache_control: { type: "ephemeral" } }] }
      : { role: m.role, content: m.content },
  );
  messages.push({ role: "system", content: context.block });

  const model = serverEnv.claudeModel;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: ChatEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false; // the browser went away; keep going so the reply is still saved
        }
      };
      const close = () => {
        if (open) controller.close();
        open = false;
      };
      send({ type: "start", userMessageId });
      send({
        type: "context",
        mode,
        attributes: context.attributes.length,
        items: context.items.map((i) => ({ id: i.id, source: i.source, title: i.title })),
      });

      let text = "";
      let stopReason: string | null = null;
      let servedBy = model;

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = claude().beta.messages.stream(
            {
              model,
              max_tokens: 32000,
              system: [{ type: "text", text: systemPrompt(profile), cache_control: { type: "ephemeral" } }],
              messages,
              tools: input.offRecord ? undefined : MEMORY_TOOLS,
              output_config: { effort: serverEnv.claudeEffort },
              ...fallbackOptions(model),
            },
            { signal: request.signal },
          );
          let roundText = "";
          for await (const event of s) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              if (!roundText && text) {
                text += "\n\n";
                send({ type: "text", text: "\n\n" });
              }
              roundText += event.delta.text;
              text += event.delta.text;
              send({ type: "text", text: event.delta.text });
            }
          }
          const final = await s.finalMessage();
          stopReason = final.stop_reason;
          servedBy = final.model;

          const toolUses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (final.stop_reason !== "tool_use" || !toolUses.length || !conversation) break;

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const block of toolUses) {
            const r = await runMemoryTool(supabase, block, { conversationId: conversation.id, excerpt: lastUser });
            if (r.proposal) send({ type: "proposal", proposal: r.proposal });
            results.push({ type: "tool_result", tool_use_id: block.id, content: r.result, is_error: r.isError || undefined });
          }
          messages.push({ role: "assistant", content: final.content });
          messages.push({ role: "user", content: results });
        }

        if (stopReason === "refusal" && !text) {
          text = "_I can't continue with this one._";
          send({ type: "text", text });
        }
      } catch (error) {
        const { message } = describeAiError(error);
        if (!text) {
          send({ type: "error", message });
          close();
          return;
        }
        stopReason = "interrupted";
      }

      let messageId: string | undefined;
      if (conversation && text.trim()) {
        const { data: saved } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            role: "assistant",
            content: text,
            context_memory_ids: context.items.filter((i) => i.source === "memory").map((i) => i.id),
            context_entry_ids: context.items.filter((i) => i.source === "journal").map((i) => i.id),
            context_message_ids: context.items.filter((i) => i.source === "message").map((i) => i.id),
            model: servedBy,
            stop_reason: stopReason,
          })
          .select("id")
          .single();
        messageId = saved?.id;
        const patch: Record<string, string> = { last_message_at: new Date().toISOString() };
        if (conversation.title === "Untitled conversation") {
          const t = history.find((m) => m.role === "user")?.content.replace(/\s+/g, " ").trim() ?? "";
          if (t) patch.title = t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
        }
        await supabase.from("conversations").update(patch).eq("id", conversation.id);
      }

      send({ type: "done", messageId, model: servedBy, stopReason });
      close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
