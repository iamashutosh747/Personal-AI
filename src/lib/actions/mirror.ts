"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/data";
import { attributeInput, uuid } from "@/lib/validation";
import { ATTRIBUTE_KINDS, type AttributeKind, type Observation } from "@/lib/types";

export type MirrorState = { ok: boolean; error?: string };

function done() {
  revalidatePath("/mirror");
  revalidatePath("/memory");
}

export async function addAttribute(_: MirrorState, form: FormData): Promise<MirrorState> {
  const { supabase } = await requireViewer();
  const parsed = attributeInput.safeParse({
    kind: form.get("kind"),
    label: form.get("label"),
    detail: form.get("detail") ?? "",
    rank: form.get("rank") || null,
    since: form.get("since") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { since, ...rest } = parsed.data;
  const { error } = await supabase.from("self_attributes").insert({ ...rest, ...(since ? { since } : {}) });
  if (error) return { ok: false, error: "Could not add it" };
  done();
  return { ok: true };
}

export async function updateAttribute(id: string, patch: { label?: string; detail?: string | null; rank?: number | null; ai_access?: boolean }) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  const clean: Record<string, unknown> = {};
  if (typeof patch.label === "string" && patch.label.trim()) clean.label = patch.label.trim().slice(0, 200);
  if (patch.detail !== undefined) clean.detail = patch.detail?.slice(0, 2000) || null;
  if (patch.rank !== undefined) clean.rank = patch.rank && patch.rank >= 1 && patch.rank <= 99 ? Math.round(patch.rank) : null;
  if (typeof patch.ai_access === "boolean") clean.ai_access = patch.ai_access;
  await supabase.from("self_attributes").update(clean).eq("id", id);
  done();
}

/** "No longer true": kept in your history with an end date, so change over time stays visible. */
export async function retireAttribute(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("self_attributes").update({ until: new Date().toISOString().slice(0, 10) }).eq("id", id);
  done();
}

export async function restoreAttribute(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("self_attributes").update({ until: null }).eq("id", id);
  done();
}

export async function deleteAttribute(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("self_attributes").delete().eq("id", id);
  done();
}

/** Turn an observation you agree with into your own words in the Mirror. */
export async function attributeFromObservation(observationId: string, kind: AttributeKind, label: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(observationId).success || !ATTRIBUTE_KINDS.includes(kind) || !label.trim()) return { ok: false };
  const { data: o } = await supabase.from("observations").select("id,status").eq("id", observationId).maybeSingle<Pick<Observation, "id" | "status">>();
  if (!o) return { ok: false };
  await supabase.from("self_attributes").insert({ kind, label: label.trim().slice(0, 200), origin: "observation", observation_id: o.id });
  if (o.status === "pending") await supabase.from("observations").update({ status: "accepted" }).eq("id", o.id);
  done();
  return { ok: true };
}
