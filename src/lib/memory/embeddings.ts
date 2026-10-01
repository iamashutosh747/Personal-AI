import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

// Semantic search is optional. Anthropic does not provide an embeddings model;
// Voyage AI is the provider Anthropic recommends. Without VOYAGE_API_KEY the
// app relies on Postgres full-text search, which needs no extra service.

const MODEL = "voyage-3.5";
export const EMBEDDING_DIMENSIONS = 1024;

export function embeddingsEnabled() {
  return Boolean(serverEnv.voyageKey);
}

export async function embed(text: string, inputType: "document" | "query"): Promise<number[] | null> {
  if (!embeddingsEnabled() || !text.trim()) return null;
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serverEnv.voyageKey}` },
      body: JSON.stringify({
        model: MODEL,
        input: [text.slice(0, 16000)],
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export function toPgVector(v: number[]) {
  return `[${v.join(",")}]`;
}

/** Best-effort: a failed embedding never blocks saving a memory. */
export async function refreshMemoryEmbedding(
  supabase: SupabaseClient,
  memory: { id: string; title: string; body: string; tags: string[] },
) {
  if (!embeddingsEnabled()) return;
  const vector = await embed(`${memory.title}\n${memory.tags.join(" ")}\n${memory.body}`, "document");
  if (!vector) return;
  await supabase.from("memories").update({ embedding: toPgVector(vector) }).eq("id", memory.id);
}
