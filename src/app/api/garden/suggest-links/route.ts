import { z } from "zod/v4";
import { getSession } from "@/lib/supabase/server";
import { aiConfigured, describeAiError } from "@/lib/ai/client";
import { askStructured, xmlEscape } from "@/lib/ai/structured";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Suggestions = z.object({
  connections: z.array(
    z.object({
      a: z.string().describe("id of the first memory"),
      b: z.string().describe("id of the second memory"),
      reason: z.string().describe("One sentence naming the specific shared detail."),
    }),
  ),
});

const SYSTEM = `You help someone notice connections between memories in their private archive. Suggest a connection only when two memories share something specific and checkable in their text: the same person, place, project, decision, event, or an explicit cause and consequence. Do not connect memories for a vague shared mood or theme, and do not speculate about psychology. Each reason must point to the concrete detail they share. It is fine, and often right, to return few or no connections.`;

/** Ask Claude for possible links. They are stored as *suggestions* only. */
export async function POST() {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: "Claude is not connected yet (ANTHROPIC_API_KEY)." }, { status: 503 });

  const { data: ok } = await supabase.rpc("consume_ai_quota", { p_kind: "suggest_links", p_per_minute: 2, p_per_day: 30 });
  if (!ok) return Response.json({ error: "Try again a little later." }, { status: 429 });

  const { data: profile } = await supabase.from("profiles").select("never_share_tags").eq("id", user.id).single<Pick<Profile, "never_share_tags">>();
  const blocked = profile?.never_share_tags ?? [];
  const { data: rows } = await supabase
    .from("memories")
    .select("id,kind,title,body,tags,occurred_on,created_at")
    .eq("ai_access", true)
    .order("created_at", { ascending: false })
    .limit(150);
  const memories = (rows ?? []).filter((m) => !m.tags.some((t: string) => blocked.includes(t)));
  if (memories.length < 2) return Response.json({ created: 0 });

  const { data: existing } = await supabase.from("memory_links").select("from_id,to_id");
  const seen = new Set((existing ?? []).map((l) => [l.from_id, l.to_id].sort().join("|")));
  const ids = new Set(memories.map((m) => m.id));

  const list = memories
    .map(
      (m) =>
        `<memory id="${m.id}" kind="${m.kind}" date="${m.occurred_on ?? m.created_at.slice(0, 10)}" title="${xmlEscape(m.title)}" tags="${xmlEscape(m.tags.join(", "))}">${xmlEscape(m.body.slice(0, 500))}</memory>`,
    )
    .join("\n");

  try {
    const { data } = await askStructured({
      system: SYSTEM,
      prompt: `<memories>\n${list}\n</memories>\n\nSuggest up to 8 connections between pairs of these memories, using their id attributes.`,
      schema: Suggestions,
      effort: "medium",
    });
    const fresh = (data?.connections ?? [])
      .filter((c) => c.a !== c.b && ids.has(c.a) && ids.has(c.b))
      .filter((c) => {
        const key = [c.a, c.b].sort().join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
    if (fresh.length) {
      await supabase.from("memory_links").insert(
        fresh.map((c) => ({ from_id: c.a, to_id: c.b, origin: "ai_suggested", status: "suggested", note: c.reason.slice(0, 500) })),
      );
    }
    return Response.json({ created: fresh.length });
  } catch (e) {
    const { message, status } = describeAiError(e);
    return Response.json({ error: message }, { status });
  }
}
