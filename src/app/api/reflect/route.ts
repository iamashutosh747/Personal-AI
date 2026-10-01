import { z } from "zod";
import { getSession } from "@/lib/supabase/server";
import { aiConfigured, describeAiError } from "@/lib/ai/client";
import { askStructured, xmlEscape } from "@/lib/ai/structured";
import { REFLECTION_SYSTEM, ReflectionOutput } from "@/lib/ai/reflection";
import type { JournalEntry, ObservationSource } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("questions"), entryId: z.string().uuid() }),
  z.object({ action: z.literal("summary"), period: z.enum(["week", "month"]), includePrivate: z.boolean().default(false) }),
]);

function entryXml(e: Pick<JournalEntry, "id" | "title" | "body" | "mood" | "created_at" | "mode">, limit: number) {
  return `<entry id="${e.id}" date="${e.created_at.slice(0, 10)}"${e.mood ? ` mood="${xmlEscape(e.mood)}"` : ""}${e.title ? ` title="${xmlEscape(e.title)}"` : ""}>${xmlEscape(e.body.slice(0, limit))}</entry>`;
}

export async function POST(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (!aiConfigured()) return Response.json({ error: "Claude is not connected yet (ANTHROPIC_API_KEY)." }, { status: 503 });

  const { data: ok } = await supabase.rpc("consume_ai_quota", { p_kind: "reflect", p_per_minute: 4, p_per_day: 60 });
  if (!ok) return Response.json({ error: "Let’s pause for a moment. Try again shortly." }, { status: 429 });

  const input = parsed.data;
  try {
    if (input.action === "questions") {
      // Asked explicitly on this one entry, so it is sent even if not generally AI-visible,
      // except Unfiltered entries, which are never sent.
      const { data: entry } = await supabase
        .from("journal_entries")
        .select("id,title,body,mood,created_at,mode")
        .eq("id", input.entryId)
        .maybeSingle<JournalEntry>();
      if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });
      if (entry.mode === "unfiltered") return Response.json({ error: "Unfiltered entries are never sent to the AI." }, { status: 403 });
      if (entry.body.trim().length < 20) return Response.json({ error: "Write a little more first." }, { status: 400 });

      const { data, model } = await askStructured({
        system: REFLECTION_SYSTEM,
        prompt: `${entryXml(entry, 12000)}\n\nOffer two or three follow-up questions that could help them go further with what they wrote. Return no observations unless one is clearly useful.`,
        schema: ReflectionOutput,
        effort: "low",
      });
      const excerpt = entry.body.slice(0, 200);
      const rows = [
        ...(data?.questions ?? []).slice(0, 3).map((q) => ({ kind: "question", label: "observation", statement: q })),
        ...(data?.observations ?? []).slice(0, 2).map((o) => ({ kind: o.kind, label: o.label, statement: o.statement })),
      ].map((r) => ({
        ...r,
        scope: "entry",
        entry_id: entry.id,
        model,
        sources: [{ type: "journal", id: entry.id, excerpt }] satisfies ObservationSource[],
      }));
      if (rows.length) await supabase.from("observations").insert(rows);
      return Response.json({ created: rows.length });
    }

    // Weekly or monthly reflection across entries.
    const days = input.period === "week" ? 7 : 30;
    const since = new Date(Date.now() - days * 86400000);
    let q = supabase
      .from("journal_entries")
      .select("id,title,body,mood,created_at,mode")
      .gte("created_at", since.toISOString())
      .neq("mode", "unfiltered")
      .order("created_at");
    if (!input.includePrivate) q = q.eq("ai_access", true);
    const { data: entries } = await q.returns<JournalEntry[]>();
    if (!entries || entries.length < 2) {
      return Response.json(
        { error: input.includePrivate ? "There isn’t enough writing in this period yet." : "Not enough entries are available to the AI in this period. You can include private entries for this one reflection." },
        { status: 400 },
      );
    }
    const budget = Math.max(600, Math.floor(60000 / entries.length));
    const { data, model } = await askStructured({
      system: REFLECTION_SYSTEM,
      prompt: `<entries period="last ${days} days">\n${entries.map((e) => entryXml(e, budget)).join("\n")}\n</entries>\n\nWrite a short ${input.period}ly reflection: one "summary" item describing what this stretch of writing covered, then up to four themes, patterns or shifts in stated priorities that the entries actually support. Add one or two questions worth sitting with.`,
      schema: ReflectionOutput,
      effort: "medium",
    });
    const byId = new Map(entries.map((e) => [e.id, e]));
    const periodStart = since.toISOString().slice(0, 10);
    const periodEnd = new Date().toISOString().slice(0, 10);
    const rows = [
      ...(data?.observations ?? [])
        .map((o) => ({
          kind: o.kind,
          label: o.label,
          statement: o.statement,
          sources: o.source_ids
            .filter((id) => byId.has(id))
            .slice(0, 8)
            .map((id) => ({ type: "journal" as const, id, excerpt: byId.get(id)!.body.slice(0, 200) })),
        }))
        // An item that cites nothing real is dropped, never shown.
        .filter((o) => o.sources.length > 0),
      ...(data?.questions ?? []).slice(0, 2).map((qn) => ({ kind: "question", label: "observation", statement: qn, sources: [] as ObservationSource[] })),
    ].map((r) => ({ ...r, scope: input.period === "week" ? "weekly" : "monthly", period_start: periodStart, period_end: periodEnd, model }));
    if (rows.length) await supabase.from("observations").insert(rows);
    return Response.json({ created: rows.length });
  } catch (e) {
    const { message, status } = describeAiError(e);
    return Response.json({ error: message }, { status });
  }
}
