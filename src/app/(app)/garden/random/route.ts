import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";

/** "Surprise me": any one of your memories, chosen at random. */
export async function GET(request: Request) {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.redirect(new URL("/signin", request.url));
  const { count } = await supabase.from("memories").select("id", { count: "exact", head: true });
  if (!count) return NextResponse.redirect(new URL("/garden", request.url));
  const offset = Math.floor(Math.random() * count);
  const { data } = await supabase.from("memories").select("id").order("created_at").range(offset, offset).maybeSingle();
  return NextResponse.redirect(new URL(data ? `/garden/${data.id}?found=1` : "/garden", request.url));
}
