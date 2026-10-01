import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function load(id: string) {
  const { supabase, user } = await getSession();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("media").select("id,storage_path,mime,capsule_id").eq("id", id).maybeSingle();
  return data ? { supabase, media: data } : null;
}

/**
 * Streams a private file to its owner. Supports Range requests, which iOS
 * Safari requires before it will play audio.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await load(id);
  if (!found) return new Response("Not found", { status: 404 });
  const { supabase, media } = found;

  // Media attached to a sealed, unopened capsule stays sealed too.
  if (media.capsule_id) {
    const { data: c } = await supabase.from("capsules").select("sealed_at,open_at").eq("id", media.capsule_id).single();
    if (c?.sealed_at && new Date(c.open_at) > new Date()) return new Response("Sealed", { status: 403 });
  }

  const { data, error } = await supabase.storage.from("media").download(media.storage_path);
  if (error || !data) return new Response("Not found", { status: 404 });
  const buf = new Uint8Array(await data.arrayBuffer());
  const headers: Record<string, string> = {
    "content-type": media.mime,
    "cache-control": "private, max-age=3600",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
  };

  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m) {
    const size = buf.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    if (!m[1] && !m[2]) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(buf, { headers: { ...headers, "content-length": String(buf.length) } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await load(id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  const { supabase, media } = found;
  if (media.capsule_id) {
    const { data: c } = await supabase.from("capsules").select("sealed_at").eq("id", media.capsule_id).single();
    if (c?.sealed_at) return Response.json({ error: "A sealed capsule can't be changed" }, { status: 409 });
  }
  const { error } = await supabase.from("media").delete().eq("id", media.id);
  if (error) return Response.json({ error: "Could not remove it" }, { status: 409 });
  await supabase.storage.from("media").remove([media.storage_path]);
  return Response.json({ ok: true });
}
