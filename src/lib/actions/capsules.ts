"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/data";
import { capsuleInput, uuid } from "@/lib/validation";
import { localMidnightUtc } from "@/lib/time";

export async function createCapsuleDraft() {
  const { supabase } = await requireViewer();
  const inAYear = new Date(Date.now() + 365 * 86400000);
  const { data } = await supabase
    .from("capsules")
    .insert({ title: "A letter to my future self", letter: "", open_at: inAYear.toISOString() })
    .select("id")
    .single();
  if (!data) throw new Error("Could not start a capsule");
  revalidatePath("/capsules");
  redirect(`/capsules/${data.id}`);
}

export async function saveCapsuleDraft(
  id: string,
  input: { title: string; letter: string; open_on: string; tz_offset_minutes: number; memory_ids: string[]; goals: string[] },
) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown capsule" };
  const parsed = capsuleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const openAt = localMidnightUtc(parsed.data.open_on, parsed.data.tz_offset_minutes);
  const { error } = await supabase
    .from("capsules")
    .update({
      title: parsed.data.title,
      letter: parsed.data.letter,
      open_at: openAt.toISOString(),
      memory_ids: parsed.data.memory_ids,
      goals: parsed.data.goals.filter(Boolean).slice(0, 20),
    })
    .eq("id", id)
    .is("sealed_at", null);
  if (error) return { ok: false, error: "Could not save the draft" };
  revalidatePath(`/capsules/${id}`);
  return { ok: true };
}

/** Seal a capsule. From this moment the database refuses any change to it. */
export async function sealCapsule(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Unknown capsule" };
  const { data: draft } = await supabase.rpc("read_capsule", { p_id: id }).maybeSingle<{ letter: string; open_at: string; sealed_at: string | null }>();
  if (!draft || draft.sealed_at) return { ok: false, error: "This capsule is already sealed" };
  if (!draft.letter.trim()) return { ok: false, error: "Write the letter before sealing it" };
  if (new Date(draft.open_at).getTime() <= Date.now() + 3600000) return { ok: false, error: "Choose an opening date in the future" };
  const { error } = await supabase.from("capsules").update({ sealed_at: new Date().toISOString() }).eq("id", id).is("sealed_at", null);
  if (error) return { ok: false, error: "Could not seal it" };
  revalidatePath("/capsules");
  revalidatePath(`/capsules/${id}`);
  return { ok: true };
}

/** Open a capsule whose day has come. Returns the letter exactly as it was written. */
export async function openCapsule(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return { ok: false as const, error: "Unknown capsule" };
  const { data, error } = await supabase
    .rpc("read_capsule", { p_id: id })
    .maybeSingle<{ id: string; title: string; letter: string; open_at: string; sealed_at: string; opened_at: string }>();
  if (error || !data) return { ok: false as const, error: "It isn’t time yet." };
  revalidatePath("/");
  revalidatePath("/capsules");
  return { ok: true as const, capsule: data };
}

export async function deleteCapsule(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const { data: media } = await supabase.from("media").select("storage_path").eq("capsule_id", id);
  await supabase.from("capsules").delete().eq("id", id);
  if (media?.length) await supabase.storage.from("media").remove(media.map((m) => m.storage_path));
  revalidatePath("/capsules");
  redirect("/capsules");
}
