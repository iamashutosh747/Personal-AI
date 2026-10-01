"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/data";
import { uuid } from "@/lib/validation";

const status = z.enum(["accepted", "rejected", "corrected", "pending"]);

/** The person has the last word on every AI observation. */
export async function reviewObservation(id: string, next: z.infer<typeof status>, correction?: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success || !status.safeParse(next).success) return { ok: false };
  const { error } = await supabase
    .from("observations")
    .update({ status: next, correction: next === "corrected" ? (correction ?? "").slice(0, 4000) || null : null })
    .eq("id", id);
  revalidatePath("/reflect");
  revalidatePath("/mirror");
  revalidatePath("/memory");
  return { ok: !error };
}

export async function deleteObservation(id: string) {
  const { supabase } = await requireViewer();
  if (!uuid.safeParse(id).success) return;
  await supabase.from("observations").delete().eq("id", id);
  revalidatePath("/reflect");
  revalidatePath("/mirror");
  revalidatePath("/memory");
}
