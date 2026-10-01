import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newUser, sql, stackEnv, stackIsUp } from "../helpers/stack";

// Runs against the real migrations on the local stack: `node tests/stack/stack.mjs`.
const env = stackEnv();
const up = await stackIsUp(env);

describe.skipIf(!up)("database security (RLS and guards)", () => {
  let a: Awaited<ReturnType<typeof newUser>>;
  let b: Awaited<ReturnType<typeof newUser>>;
  let aMemory: string;

  beforeAll(async () => {
    a = await newUser(env, "alice");
    b = await newUser(env, "bob");
    const { data } = await a.client.from("memories").insert({ title: "Alice's secret", body: "only mine", tags: ["career"] }).select("id").single();
    aMemory = data!.id;
  });

  afterAll(async () => {
    await sql(env, "delete from auth.users where email like '%@inner.test' and email not like 'owner@%'");
  });

  it("creates a private profile for each new account", async () => {
    const { data } = await a.client.from("profiles").select("id,space_name");
    expect(data).toEqual([{ id: a.id, space_name: "The Inner World" }]);
  });

  it("isolates every user-owned table between accounts", async () => {
    const tables = ["memories", "journal_entries", "conversations", "messages", "memory_proposals", "observations", "self_attributes", "media", "memory_links", "profiles"];
    await a.client.from("journal_entries").insert({ body: "dear diary" });
    const { data: convo } = await a.client.from("conversations").insert({ title: "mine" }).select("id").single();
    await a.client.from("messages").insert({ conversation_id: convo!.id, role: "user", content: "hello" });
    await a.client.from("self_attributes").insert({ kind: "value", label: "honesty" });
    for (const t of tables) {
      const { data, error } = await b.client.from(t).select("*");
      expect(error, t).toBeNull();
      expect((data ?? []).filter((r: Record<string, unknown>) => r.user_id === a.id || r.id === a.id), t).toEqual([]);
    }
  });

  it("refuses writes into someone else's records", async () => {
    const upd = await b.client.from("memories").update({ title: "hacked" }).eq("id", aMemory).select();
    expect(upd.data).toEqual([]);
    const forged = await b.client.from("memories").insert({ user_id: a.id, title: "forged" });
    expect(forged.error).not.toBeNull();
    // Composite foreign keys stop pointing your rows at another person's.
    const { data: bm } = await b.client.from("memories").insert({ title: "bob's" }).select("id").single();
    const link = await b.client.from("memory_links").insert({ from_id: bm!.id, to_id: aMemory });
    expect(link.error).not.toBeNull();
    const msg = await b.client.from("messages").insert({ conversation_id: (await a.client.from("conversations").select("id").limit(1).single()).data!.id, role: "user", content: "x" });
    expect(msg.error).not.toBeNull();
  });

  it("gives anonymous visitors nothing", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const t of ["memories", "profiles", "capsules"]) {
      const { data } = await anon.from(t).select("*");
      expect(data ?? []).toEqual([]);
    }
    const { data } = await anon.rpc("retrieve_context", { p_query: "secret" });
    expect(data ?? []).toEqual([]);
  });

  it("closes sign-ups once the owner exists, unless allow-listed", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.auth.signUp({ email: `stranger-${Date.now()}@inner.test`, password: "a long test password" });
    expect(error).not.toBeNull();
    const allow = await anon.from("signup_allowlist").select("*");
    expect(allow.data ?? []).toEqual([]);
  });

  it("only retrieves AI-visible memories, honouring never-share tags and memory modes", async () => {
    const { data: priv } = await a.client.from("memories").insert({ title: "Private career doubts", body: "career change worries", ai_access: false }).select("id").single();
    const r1 = await a.client.rpc("retrieve_context", { p_query: "career" });
    const ids1 = (r1.data as { id: string }[]).map((r) => r.id);
    expect(ids1).toContain(aMemory);
    expect(ids1).not.toContain(priv!.id);

    await a.client.from("profiles").update({ never_share_tags: ["career"] }).eq("id", a.id);
    const r2 = await a.client.rpc("retrieve_context", { p_query: "career" });
    expect((r2.data as { id: string }[]).map((r) => r.id)).not.toContain(aMemory);
    await a.client.from("profiles").update({ never_share_tags: [] }).eq("id", a.id);

    const none = await a.client.rpc("retrieve_context", { p_query: "career", p_memory_mode: "none" });
    expect(none.data).toEqual([]);
    // Choosing a memory for one conversation is explicit consent, even for a private one.
    const chosen = await a.client.rpc("retrieve_context", { p_query: "anything", p_memory_mode: "chosen", p_chosen: [priv!.id] });
    expect((chosen.data as { id: string }[]).map((r) => r.id)).toEqual([priv!.id]);
    // Bob cannot retrieve Alice's memory even by choosing its id.
    const theft = await b.client.rpc("retrieve_context", { p_query: "x", p_memory_mode: "chosen", p_chosen: [aMemory] });
    expect(theft.data).toEqual([]);
  });

  it("keeps sealed capsule letters unreadable and unchangeable until their day", async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    const { data: cap } = await a.client.from("capsules").insert({ title: "Later", letter: "hello future", open_at: future }).select("id").single();
    expect((await a.client.from("capsules").select("letter")).error).not.toBeNull();
    expect((await a.client.rpc("read_capsule", { p_id: cap!.id }).single<{ letter: string }>()).data?.letter).toBe("hello future");

    await a.client.from("capsules").update({ sealed_at: new Date().toISOString() }).eq("id", cap!.id);
    expect((await a.client.rpc("read_capsule", { p_id: cap!.id })).error?.message).toMatch(/sealed until/);
    expect((await a.client.from("capsules").update({ letter: "changed" }).eq("id", cap!.id)).error?.message).toMatch(/sealed capsule/);
    expect((await a.client.from("capsules").update({ open_at: new Date().toISOString() }).eq("id", cap!.id)).error?.message).toMatch(/sealed capsule/);
    expect((await a.client.from("capsules").update({ sealed_at: null }).eq("id", cap!.id)).error?.message).toMatch(/sealed capsule/);
    expect((await b.client.rpc("read_capsule", { p_id: cap!.id })).error?.message).toMatch(/not found/i);

    // When its day comes (simulated as superuser), it opens once and records when.
    await sql(env, "alter table public.capsules disable trigger capsules_guard");
    await sql(env, "update public.capsules set open_at = now() - interval '1 minute' where id = $1", [cap!.id]);
    await sql(env, "alter table public.capsules enable trigger capsules_guard");
    const opened = await a.client.rpc("read_capsule", { p_id: cap!.id }).single<{ letter: string; opened_at: string }>();
    expect(opened.data?.letter).toBe("hello future");
    expect(opened.data?.opened_at).toBeTruthy();
  });

  it("rate limits AI calls per user", async () => {
    const calls = [];
    for (let i = 0; i < 4; i++) calls.push((await a.client.rpc("consume_ai_quota", { p_kind: "test", p_per_minute: 3, p_per_day: 100 })).data);
    expect(calls).toEqual([true, true, true, false]);
    expect((await b.client.rpc("consume_ai_quota", { p_kind: "test", p_per_minute: 3, p_per_day: 100 })).data).toBe(true);
    // Each kind of call has its own budget: a busy chat doesn't block a reflection.
    expect((await a.client.rpc("consume_ai_quota", { p_kind: "other", p_per_minute: 1, p_per_day: 100 })).data).toBe(true);
  });

  it("keeps stored files private to their owner", async () => {
    const path = `${a.id}/probe.png`;
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await a.client.storage.from("media").upload(path, png, { contentType: "image/png" })).error).toBeNull();
    expect((await b.client.storage.from("media").download(path)).error).not.toBeNull();
    expect((await b.client.storage.from("media").upload(`${a.id}/intruder.png`, png, { contentType: "image/png" })).error).not.toBeNull();
    expect((await a.client.storage.from("media").download(path)).data).toBeTruthy();
  });

  it("deletes all of a user's data on request, and nobody else's", async () => {
    await b.client.from("journal_entries").insert({ body: "bob writes" });
    expect((await b.client.rpc("delete_my_data")).error).toBeNull();
    for (const t of ["memories", "journal_entries", "conversations", "self_attributes", "capsules"]) {
      const { data } = await b.client.from(t).select("id");
      expect(data, t).toEqual([]);
    }
    const { data: alice } = await a.client.from("memories").select("id");
    expect(alice!.length).toBeGreaterThan(0);
  });
});
