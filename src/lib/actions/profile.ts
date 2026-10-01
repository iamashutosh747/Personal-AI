"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/data";
import { parseTags, profileInput } from "@/lib/validation";
import { MEMORY_COLUMNS, type Memory } from "@/lib/types";
import { refreshMemoryEmbedding } from "@/lib/memory/embeddings";

export async function updateProfile(patch: Record<string, unknown>) {
  const { supabase, user } = await requireViewer();
  const clean = { ...patch };
  if ("never_share_tags" in clean) clean.never_share_tags = parseTags(clean.never_share_tags);
  const parsed = profileInput.safeParse(clean);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: "Could not save your settings" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Finish onboarding. Optional notes the user chooses to import become ordinary,
 * editable memories marked with source "import". Nothing else is created.
 */
export async function completeOnboarding(input: {
  profile: Record<string, unknown>;
  importNotes?: string;
  aboutMe?: string;
}) {
  const { supabase, user, profile } = await requireViewer();
  const res = await updateProfile(input.profile);
  if (!res.ok) return res;

  const toInsert: Partial<Memory>[] = [];
  const about = input.aboutMe?.trim();
  if (about) {
    toInsert.push({
      kind: "preference",
      title: "How I'd like to be met",
      body: about.slice(0, 4000),
      source_type: "import",
      ai_access: true,
    });
  }
  const notes = (input.importNotes ?? "")
    .split(/\n\s*\n/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 50);
  for (const note of notes) {
    const first = note.split("\n")[0]!;
    toInsert.push({
      kind: "reflection",
      title: first.length > 80 ? `${first.slice(0, 77)}…` : first,
      body: note === first ? "" : note.slice(0, 20000),
      source_type: "import",
      ai_access: (input.profile.default_ai_access as boolean | undefined) ?? profile.default_ai_access,
    });
  }
  if (toInsert.length) {
    const { data } = await supabase.from("memories").insert(toInsert).select(MEMORY_COLUMNS).returns<Memory[]>();
    for (const m of data ?? []) await refreshMemoryEmbedding(supabase, m);
  }
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
