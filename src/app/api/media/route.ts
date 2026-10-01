import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/supabase/server";
import { ALLOWED_MEDIA, MAX_UPLOAD_BYTES, baseMime, sniffMatches } from "@/lib/media";

export const runtime = "nodejs";

const owner = z.object({
  memoryId: z.string().uuid().optional(),
  capsuleId: z.string().uuid().optional(),
  journalId: z.string().uuid().optional(),
  caption: z.string().max(500).optional(),
});

/** Upload a photo or voice recording into the private bucket, under the user's own folder. */
export async function POST(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const meta = owner.safeParse({
    memoryId: form.get("memoryId") || undefined,
    capsuleId: form.get("capsuleId") || undefined,
    journalId: form.get("journalId") || undefined,
    caption: form.get("caption") || undefined,
  });
  if (!meta.success || [meta.data.memoryId, meta.data.capsuleId, meta.data.journalId].filter(Boolean).length !== 1) {
    return Response.json({ error: "Attach the file to exactly one item" }, { status: 400 });
  }

  const mime = baseMime(file.type);
  const allowed = ALLOWED_MEDIA[mime];
  if (!allowed) return Response.json({ error: "That file type isn't supported" }, { status: 415 });
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Files must be under 25 MB" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffMatches(mime, bytes.subarray(0, 16))) {
    return Response.json({ error: "The file doesn't look like the type it claims to be" }, { status: 415 });
  }

  const path = `${user.id}/${randomUUID()}.${allowed.ext}`;
  const up = await supabase.storage.from("media").upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) return Response.json({ error: "Upload failed" }, { status: 500 });

  const { data, error } = await supabase
    .from("media")
    .insert({
      memory_id: meta.data.memoryId ?? null,
      capsule_id: meta.data.capsuleId ?? null,
      journal_entry_id: meta.data.journalId ?? null,
      kind: allowed.kind,
      storage_path: path,
      mime,
      bytes: file.size,
      caption: meta.data.caption ?? null,
    })
    .select("id,kind,mime,caption,created_at")
    .single();
  if (error || !data) {
    await supabase.storage.from("media").remove([path]);
    const sealed = error?.message?.includes("sealed");
    return Response.json({ error: sealed ? "A sealed capsule can't be changed" : "Could not attach the file" }, { status: sealed ? 409 : 500 });
  }
  return Response.json({ media: data });
}
