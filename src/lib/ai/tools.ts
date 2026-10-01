import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MEMORY_KINDS, type MemoryProposal } from "@/lib/types";
import { parseTags } from "@/lib/validation";

// Both tools only ever create a *pending proposal*. The person approves,
// edits or dismisses it in the app; the model never writes memories directly.

export const MEMORY_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "propose_memory",
    description:
      "Suggest saving something the person shared as a memory in their Memory Garden. Use for durable, meaningful things (decisions, realizations, important events, goals, stated preferences, people who matter) or when they ask you to remember something. The suggestion waits for their approval; it is not saved until they accept it.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "A short title in their voice, under 80 characters." },
        body: {
          type: "string",
          description: "What to remember, written plainly and faithfully to what they said. Do not add interpretation.",
        },
        kind: { type: "string", enum: [...MEMORY_KINDS] },
        tags: { type: "array", items: { type: "string" }, description: "Up to five short lowercase tags." },
        reason: { type: "string", description: "One sentence on why this seems worth keeping, shown to them." },
      },
      required: ["title", "body", "kind", "tags", "reason"],
    },
  },
  {
    name: "propose_memory_correction",
    description:
      "Suggest updating or forgetting one of their saved memories that appears in your context, when they say it is wrong, outdated or should be removed. Waits for their approval.",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        memory_id: { type: "string", description: "The id attribute of the memory from your context." },
        action: { type: "string", enum: ["update", "forget"] },
        title: { type: "string", description: "Corrected title (for update; repeat the old one if unchanged)." },
        body: { type: "string", description: "Corrected text (for update; empty for forget)." },
        reason: { type: "string", description: "One sentence on what changed, shown to them." },
      },
      required: ["memory_id", "action", "title", "body", "reason"],
    },
  },
];

const proposeMemory = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20000),
  kind: z.enum(MEMORY_KINDS),
  tags: z.array(z.string()).max(20),
  reason: z.string().max(1000),
});

const proposeCorrection = z.object({
  memory_id: z.string().uuid(),
  action: z.enum(["update", "forget"]),
  title: z.string().max(200),
  body: z.string().max(20000),
  reason: z.string().max(1000),
});

export type ProposalEvent = Pick<MemoryProposal, "id" | "action" | "title" | "body" | "kind" | "tags" | "reason" | "target_memory_id">;

export async function runMemoryTool(
  supabase: SupabaseClient,
  block: { name: string; input: unknown },
  source: { conversationId: string; excerpt: string },
): Promise<{ result: string; isError: boolean; proposal?: ProposalEvent }> {
  if (block.name === "propose_memory") {
    const parsed = proposeMemory.safeParse(block.input);
    if (!parsed.success) return { result: "Invalid input: " + parsed.error.issues[0]?.message, isError: true };
    const { data, error } = await supabase
      .from("memory_proposals")
      .insert({
        action: "create",
        title: parsed.data.title,
        body: parsed.data.body,
        kind: parsed.data.kind,
        tags: parseTags(parsed.data.tags).slice(0, 5),
        reason: parsed.data.reason,
        source_type: "conversation",
        source_id: source.conversationId,
        source_excerpt: source.excerpt.slice(0, 4000),
      })
      .select("id,action,title,body,kind,tags,reason,target_memory_id")
      .single<ProposalEvent>();
    if (error || !data) return { result: "Could not save the suggestion.", isError: true };
    return { result: "Suggestion saved. It is waiting for the person's approval and is not a memory yet.", isError: false, proposal: data };
  }

  if (block.name === "propose_memory_correction") {
    const parsed = proposeCorrection.safeParse(block.input);
    if (!parsed.success) return { result: "Invalid input: " + parsed.error.issues[0]?.message, isError: true };
    // RLS guarantees this only finds the person's own memory.
    const { data: target } = await supabase.from("memories").select("id,kind").eq("id", parsed.data.memory_id).maybeSingle();
    if (!target) return { result: "No memory with that id is available.", isError: true };
    const { data, error } = await supabase
      .from("memory_proposals")
      .insert({
        action: parsed.data.action,
        target_memory_id: target.id,
        kind: target.kind,
        title: parsed.data.action === "update" ? parsed.data.title || null : null,
        body: parsed.data.action === "update" ? parsed.data.body : null,
        reason: parsed.data.reason,
        source_type: "conversation",
        source_id: source.conversationId,
        source_excerpt: source.excerpt.slice(0, 4000),
      })
      .select("id,action,title,body,kind,tags,reason,target_memory_id")
      .single<ProposalEvent>();
    if (error || !data) return { result: "Could not save the suggestion.", isError: true };
    return { result: "Correction suggested. It is waiting for the person's approval.", isError: false, proposal: data };
  }

  return { result: `Unknown tool ${block.name}`, isError: true };
}
