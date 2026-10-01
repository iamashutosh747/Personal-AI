import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/supabase/server";
import { publicEnv, serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Permanently delete everything. Order matters: files first (Storage API),
 * then every row (as the user, under RLS), then the login itself.
 */
export async function DELETE(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "delete everything") return Response.json({ error: "Confirmation phrase missing" }, { status: 400 });

  // 1. Files: everything recorded in `media`, plus anything else in the user's folder.
  const paths = new Set<string>();
  const { data: media } = await supabase.from("media").select("storage_path");
  for (const m of media ?? []) paths.add(m.storage_path);
  const { data: listed } = await supabase.storage.from("media").list(user.id, { limit: 1000 });
  for (const f of listed ?? []) if (f.name) paths.add(`${user.id}/${f.name}`);
  const list = [...paths];
  for (let i = 0; i < list.length; i += 100) {
    const { error } = await supabase.storage.from("media").remove(list.slice(i, i + 100));
    if (error) return Response.json({ error: "Could not remove your files. Nothing else was deleted." }, { status: 500 });
  }

  // 2. Rows.
  const { error } = await supabase.rpc("delete_my_data");
  if (error) return Response.json({ error: "Could not delete your records." }, { status: 500 });

  // 3. The login. Needs the service-role key, used only here and only server side.
  let accountRemoved = false;
  if (serverEnv.serviceRoleKey) {
    const admin = createAdminClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: adminError } = await admin.auth.admin.deleteUser(user.id);
    accountRemoved = !adminError;
  }
  await supabase.auth.signOut();
  return Response.json({ ok: true, accountRemoved });
}
