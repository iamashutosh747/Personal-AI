import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** The signed-in user and their profile, memoised for one request. */
export const getViewer = cache(async () => {
  const { supabase, user } = await getSession();
  if (!user) return { supabase, user: null, profile: null } as const;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  return { supabase, user, profile: data } as const;
});

/** For pages and actions that need a signed-in user. */
export async function requireViewer() {
  const v = await getViewer();
  if (!v.user) redirect("/signin");
  if (!v.profile) redirect("/signin");
  return v as { supabase: typeof v.supabase; user: NonNullable<typeof v.user>; profile: Profile };
}
