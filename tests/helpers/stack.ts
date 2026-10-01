import { execFileSync } from "node:child_process";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

/** Connection details for the local test stack (tests/stack/stack.mjs). */
export function stackEnv(): Record<string, string> {
  const out = execFileSync("node", [path.resolve(import.meta.dirname, "../stack/stack.mjs"), "--env"]).toString();
  return Object.fromEntries(out.trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
}

export async function stackIsUp(env = stackEnv()) {
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function sql(env: Record<string, string>, text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** Creates a user (allow-listing the address first, since sign-ups are closed after the owner). */
export async function newUser(env: Record<string, string>, label: string): Promise<{ client: SupabaseClient; id: string; email: string }> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@inner.test`;
  await sql(env, "insert into public.signup_allowlist (email) values ($1) on conflict do nothing", [email]);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email, password: "a long test password" });
  if (error || !data.user) throw error ?? new Error("sign up failed");
  return { client, id: data.user.id, email };
}
