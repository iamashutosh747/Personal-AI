import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// One person's whole journey through The Inner World, in order.
// The Claude API is the mock in tests/mock-anthropic.mjs.

const EMAIL = "e2e-owner@inner.test";
const PASSWORD = "a long e2e password";
const env = Object.fromEntries(
  execFileSync("node", ["tests/stack/stack.mjs", "--env"]).toString().trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

async function db<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" });

let page: Page;
const pageErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
});

test.afterEach(() => {
  expect(pageErrors, "uncaught errors in the page").toEqual([]);
});

test("private by default: nothing is reachable without signing in", async ({ request }) => {
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(307);
  expect(home.headers().location).toContain("/signin");
  expect((await request.get("/api/export")).status()).toBe(401);
  expect((await request.post("/api/chat", { data: { text: "hi" } })).status()).toBe(401);
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
});

test("the owner creates the space and is onboarded", async () => {
  await page.goto("/signin");
  await page.getByText("First time here?").click();
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create my space" }).click();
  await page.waitForURL("**/welcome");
  await page.fill("#space", "Lantern");
  await page.fill("#name", "Ashu");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Socratic/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Quiet Observatory/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.fill("#about", "I think best when someone pushes back a little.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Enter" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ashu");
  await expect(page.locator("html")).toHaveAttribute("data-world", "quiet-observatory");
  // The onboarding answer became a visible, editable preference: nothing hidden.
  const prefs = await db("select kind, source_type from memories");
  expect(prefs).toEqual([{ kind: "preference", source_type: "import" }]);
});

test("a second sign-up is refused", async ({ browser }) => {
  const p = await browser.newPage();
  await p.goto("/signin");
  await p.getByText("First time here?").click();
  await p.fill("#email", "someone-else@inner.test");
  await p.fill("#password", PASSWORD);
  await p.getByRole("button", { name: "Create my space" }).click();
  await expect(p.getByText("This Inner World is private.")).toBeVisible();
  await p.close();
});

test("the garden keeps a memory with a photograph", async () => {
  await page.goto("/garden/new");
  await page.getByRole("button", { name: "Goal or ambition" }).click();
  await page.fill("#title", "Career direction");
  await page.fill("#body", "I want to move from engineering toward design research within two years.");
  await page.fill("#tags", "career, work");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.setInputFiles('input[type="file"]', { name: "desk.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Keep this memory" }).click();
  await page.waitForURL(/\/garden\/[0-9a-f-]{36}\?saved=1/);
  await expect(page.getByRole("status")).toContainText("Planted");
  const img = page.locator('img[alt="A photograph you kept"]');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  // A disguised file is refused.
  const bad = await page.request.post("/api/media", {
    multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") }, memoryId: page.url().split("/garden/")[1]!.split("?")[0]! },
  });
  expect(bad.status()).toBe(415);
});

test("conversations draw on memories and say which ones", async () => {
  await page.goto("/");
  await page.fill("#ask", "I have been thinking about changing my career again");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/talk\/[0-9a-f-]{36}/);
  await expect(page.getByText("saved memories for this reply")).toBeVisible();
  await page.getByRole("button", { name: /Drew on \d+ record/ }).click();
  await expect(page.getByRole("link", { name: "Career direction" })).toBeVisible();

  // The context sent to Claude carried the memory, inside a system message.
  const log = await db<{ content: string; context_memory_ids: string[] }>("select content, context_memory_ids from messages where role = 'assistant'");
  expect(log[0]!.context_memory_ids.length).toBeGreaterThan(0);
});

test("Claude can only suggest memories; the person decides", async () => {
  await page.fill("#composer", "Please remember that I decided to apply to the research programme in spring.");
  await page.keyboard.press("Enter");
  await expect(page.getByText("waiting for your approval").first()).toBeVisible();
  const before = await db("select id from memories where source_type = 'conversation'");
  expect(before).toHaveLength(0);
  await page.getByRole("button", { name: "Edit first" }).click();
  await page.getByLabel("Title").fill("Applying to the research programme");
  await page.getByRole("button", { name: "Save my version" }).click();
  await expect(page.getByText("Kept.")).toBeVisible();
  const after = await db<{ title: string }>("select title from memories where source_type = 'conversation'");
  expect(after).toEqual([{ title: "Applying to the research programme" }]);
});

test("a message can be kept verbatim, and the thread turned into a journal entry", async () => {
  await page.getByRole("button", { name: "Keep as memory" }).first().click();
  await expect(page.getByText("Kept as a memory").first()).toBeVisible();
  await page.getByRole("button", { name: "Conversation options" }).click();
  await page.getByRole("menuitem", { name: "Turn into a journal entry" }).click();
  await page.waitForURL(/\/reflect\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Claude (AI)").first()).toBeVisible();
});

test("off the record leaves no trace in the database", async () => {
  const count = async () => Number((await db<{ n: string }>("select count(*) as n from messages"))[0]!.n);
  const before = await count();
  await page.goto("/talk/off-record");
  await page.fill("#composer", "Just between us, a passing thought.");
  await page.keyboard.press("Enter");
  await expect(page.getByText("You said: Just between us")).toBeVisible();
  expect(await count()).toBe(before);
  expect(await db("select id from memory_proposals where status = 'pending'")).toHaveLength(0);
});

test("the reflection room keeps entries, and AI notes stay labelled and separate", async () => {
  await page.goto("/reflect/write?mode=unfiltered");
  await page.getByLabel("Entry").fill("Unfiltered: nothing here goes anywhere.");
  await page.waitForURL(/\/reflect\/[0-9a-f-]{36}\/edit/);
  await page.getByRole("button", { name: "Leave focus mode" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL(/\/reflect\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Ask me a few questions" })).toHaveCount(0);
  await expect(page.getByText("never sent to the AI")).toBeVisible();

  await page.goto("/reflect/write?mode=daily_reset");
  await page.getByLabel("Entry").fill("The interview went better than I feared. I want to keep going with the application.");
  await page.getByRole("button", { name: "hopeful" }).click();
  await page.waitForURL(/\/reflect\/[0-9a-f-]{36}\/edit/);
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL(/\/reflect\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Ask me a few questions" }).click();
  await expect(page.getByText("AI question")).toBeVisible();
  await expect(page.getByText("AI hypothesis")).toBeVisible();
  await page.getByRole("button", { name: "Correct it" }).click();
  await page.getByLabel("Your correction").fill("It's less about meaning and more about curiosity.");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Your words")).toBeVisible();
  // The original entry was never touched.
  const entry = await db<{ body: string }>("select body from journal_entries where mode = 'daily_reset'");
  expect(entry[0]!.body).toBe("The interview went better than I feared. I want to keep going with the application.");
});

test("the mirror is written by the person; AI patterns cite their sources", async () => {
  await page.goto("/mirror");
  await page.getByRole("button", { name: "Add to Values" }).click();
  await page.getByLabel("Label").fill("Honesty, even when it costs something");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Honesty, even when it costs something" })).toBeVisible();
  await page.getByRole("button", { name: "Look for patterns" }).click();
  await expect(page.getByText("You return often to the question of meaningful work.")).toBeVisible();
  await page.getByText(/Based on 1 record/).first().click();
  const sources = await db<{ sources: { id: string }[] }>("select sources from observations where scope = 'mirror'");
  expect(sources[0]!.sources.length).toBeGreaterThan(0);
});

test("a sealed capsule cannot be read before its day", async () => {
  await page.goto("/capsules");
  await page.getByRole("button", { name: "Write a letter" }).click();
  await page.waitForURL(/\/capsules\/[0-9a-f-]{36}$/);
  await page.getByLabel("Your letter").fill("Dear Ashu,\n\nI hope you took the leap.");
  await page.getByRole("button", { name: "In a year" }).click();
  await page.getByRole("button", { name: "Seal it" }).click();
  await page.getByRole("button", { name: "Seal", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/capsules");
  await page.getByRole("link", { name: /A letter to my future self/ }).click();
  await expect(page.getByText("Until then, nobody can read it")).toBeVisible();
  expect(await page.content()).not.toContain("I hope you took the leap");
});

test("a capsule whose day has come opens exactly as written", async () => {
  const [cap] = await db<{ id: string }>("select id from capsules limit 1");
  await db("alter table public.capsules disable trigger capsules_guard");
  await db("update public.capsules set open_at = now() - interval '1 minute' where id = $1", [cap!.id]);
  await db("alter table public.capsules enable trigger capsules_guard");
  await page.goto("/");
  await expect(page.getByText("A time capsule is ready to open")).toBeVisible();
  await page.getByText("A time capsule is ready to open").click();
  await page.getByRole("button", { name: "Break the seal" }).click();
  await expect(page.getByText("I hope you took the leap.")).toBeVisible();
});

test("the ledger shows everything the AI can see, and access can be changed", async () => {
  await page.goto("/memory");
  await expect(page.getByRole("heading", { name: "Everything the AI can see" })).toBeVisible();
  const row = page.getByRole("row", { name: /Career direction/ });
  await row.getByRole("switch").click();
  await expect.poll(async () => (await db<{ ai_access: boolean }>("select ai_access from memories where title = 'Career direction'"))[0]!.ai_access).toBe(false);
  await page.getByRole("link", { name: "Private", exact: true }).click();
  await expect(page.getByRole("row", { name: /Career direction/ }).getByRole("switch")).toHaveText("Private");
});

test("settings change the world, and export contains everything", async () => {
  await page.goto("/settings");
  await page.getByRole("button", { name: /Rainy Window/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-world", "rainy-window");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download everything (.zip)" }).click();
  const file = await (await download).path();
  const listing = execFileSync("python3", [
    "-c",
    "import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);d=json.loads(z.read('inner-world.json'));print(len([n for n in z.namelist() if n.startswith('media/')]), [m['title'] for m in d['memories']], [c['letter'] for c in d['time_capsules']])",
    file!,
  ]).toString();
  expect(listing).toMatch(/^1 /);
  expect(listing).toContain("Career direction");
  expect(listing).toContain("I hope you took the leap.");
  fs.rmSync(file!, { force: true });
});

test("mobile has its own navigation", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await page.context().storageState() });
  const m = await ctx.newPage();
  await m.goto("/");
  const nav = m.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: "Quick capture" }).click();
  await m.getByLabel("Memory").fill("A thought on the train");
  await m.getByRole("button", { name: "Keep it" }).click();
  await expect(m.getByText("Kept.")).toBeVisible();
  await ctx.close();
});

test("delete everything removes every record, every file and the login", async () => {
  await page.goto("/settings#data");
  await page.getByRole("button", { name: "Delete everything…" }).click();
  await page.getByLabel("Confirmation").fill("delete everything");
  await page.getByRole("button", { name: "Delete everything", exact: true }).click();
  await page.waitForURL(/\/signin\?farewell=1/);
  for (const t of ["memories", "journal_entries", "conversations", "messages", "capsules", "media", "observations", "self_attributes"]) {
    expect(await db(`select 1 from public.${t}`), t).toHaveLength(0);
  }
  expect(await db("select 1 from auth.users")).toHaveLength(0);
  expect(await db("select 1 from storage.objects")).toHaveLength(0);
});
