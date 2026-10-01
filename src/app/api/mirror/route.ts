import { getSession } from "@/lib/supabase/server";
import { aiConfigured, describeAiError } from "@/lib/ai/client";
import { askStructured, xmlEscape } from "@/lib/ai/structured";
import { REFLECTION_SYSTEM, ReflectionOutput } from "@/lib/ai/reflection";
import type { ObservationSource, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * "Look for patterns": reads only what is marked available to the AI and
 * returns labelled, source-cited suggestions for the Mirror. It never edits
 * the person's self-description; they choose what (if anything) to adopt.
 */
export async function POST() {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: "Claude is not connected yet (ANTHROPIC_API_KEY)." }, { status: 503 });
  const { data: ok } = await supabase.rpc("consume_ai_quota", { p_kind: "mirror", p_per_minute: 2, p_per_day: 20 });
  if (!ok) return Response.json({ error: "Try again a little later." }, { status: 429 });

  const { data: profile } = await supabase.from("profiles").select("never_share_tags").eq("id", user.id).single<Pick<Profile, "never_share_tags">>();
  const blocked = profile?.never_share_tags ?? [];

  const [{ data: memories }, { data: entries }, { data: attributes }] = await Promise.all([
    supabase.from("memories").select("id,kind,title,body,tags,occurred_on,created_at").eq("ai_access", true).order("created_at", { ascending: false }).limit(80),
    supabase.from("journal_entries").select("id,title,body,created_at,mode").eq("ai_access", true).neq("mode", "unfiltered").order("created_at", { ascending: false }).limit(30),
    supabase.from("self_attributes").select("id,kind,label,detail,since,until").eq("ai_access", true).order("since"),
  ]);
  const mems = (memories ?? []).filter((m) => !m.tags.some((t: string) => blocked.includes(t)));
  if (mems.length + (entries?.length ?? 0) < 3) {
    return Response.json({ error: "There isn’t enough here yet for patterns to mean anything. Come back once you’ve kept a little more." }, { status: 400 });
  }

  const sources = new Map<string, ObservationSource>();
  const parts: string[] = [];
  for (const a of attributes ?? []) {
    sources.set(a.id, { type: "attribute", id: a.id, excerpt: `${a.kind}: ${a.label}` });
    parts.push(`<self_description id="${a.id}" kind="${a.kind}" since="${a.since}"${a.until ? ` until="${a.until}"` : ""}>${xmlEscape(a.label)}${a.detail ? ` — ${xmlEscape(a.detail)}` : ""}</self_description>`);
  }
  for (const m of mems) {
    sources.set(m.id, { type: "memory", id: m.id, excerpt: `${m.title}${m.body ? ` — ${m.body.slice(0, 160)}` : ""}` });
    parts.push(`<memory id="${m.id}" kind="${m.kind}" date="${m.occurred_on ?? m.created_at.slice(0, 10)}" title="${xmlEscape(m.title)}">${xmlEscape(m.body.slice(0, 600))}</memory>`);
  }
  for (const e of entries ?? []) {
    sources.set(e.id, { type: "journal", id: e.id, excerpt: e.body.slice(0, 200) });
    parts.push(`<journal_entry id="${e.id}" date="${e.created_at.slice(0, 10)}">${xmlEscape(e.body.slice(0, 1200))}</journal_entry>`);
  }

  try {
    const { data, model } = await askStructured({
      system: REFLECTION_SYSTEM,
      prompt: `<records>\n${parts.join("\n")}\n</records>\n\nThe person keeps a self-description (in self_description records) and wants help noticing what they may have left out or what has changed. Offer up to five items: recurring themes in what they keep and write about, and any shifts in stated priorities over time (compare dates). Do not restate their self-description back to them unless the records add something. Each item cites its records.`,
      schema: ReflectionOutput,
      effort: "medium",
    });
    const rows = (data?.observations ?? [])
      .map((o) => ({
        scope: "mirror",
        kind: o.kind,
        label: o.label,
        statement: o.statement,
        model,
        sources: o.source_ids.filter((id) => sources.has(id)).slice(0, 8).map((id) => sources.get(id)!),
      }))
      .filter((o) => o.sources.length > 0)
      .slice(0, 5);
    if (rows.length) await supabase.from("observations").insert(rows);
    return Response.json({ created: rows.length });
  } catch (e) {
    const { message, status } = describeAiError(e);
    return Response.json({ error: message }, { status });
  }
}
