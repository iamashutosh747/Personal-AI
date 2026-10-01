import { chromium } from "@playwright/test";
const out = "/tmp/claude-0/-home-user-Personal-AI/e6ffa0aa-c8cb-5e84-ae66-073cfd3fd59d/scratchpad/shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: out + "/state.json" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text().slice(0, 300)));
// New memory with photo
await page.goto("http://localhost:3000/garden/new");
await page.getByRole("button", { name: "Place" }).click();
await page.fill("#title", "The café by the river in Porto");
await page.fill("#body", "We sat for hours watching the boats. I decided then that I wanted to live somewhere with water.");
await page.fill("#occurred_on", "2024-10-01");
await page.fill("#location", "Porto");
await page.fill("#tags", "travel, porto, career");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
await page.setInputFiles('input[type=file]', { name: "porto.png", mimeType: "image/png", buffer: png });
await page.getByRole("button", { name: "Keep this memory" }).click();
await page.waitForURL(/garden\/[0-9a-f-]{36}\?saved=1/, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: out + "/20-memory.png", fullPage: true });
// connect
await page.getByRole("button", { name: "Connect another" }).click();
await page.getByRole("button", { name: "Career direction" }).click();
await page.waitForTimeout(1200);
for (const v of ["timeline", "archive", "constellation", "calendar"]) {
  await page.goto("http://localhost:3000/garden?view=" + v + (v === "calendar" ? "&month=2024-10" : ""));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + "/21-garden-" + v + ".png" });
}
// journal
await page.goto("http://localhost:3000/reflect/write?mode=daily_reset");
await page.fill('textarea[aria-label="Entry"]', "Today was long but good. The interview went better than I feared, and I want to keep going with the research application.");
await page.getByRole("button", { name: "hopeful" }).click();
await page.waitForURL(/reflect\/[0-9a-f-]{36}\/edit/, { timeout: 15000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Finish" }).click();
await page.waitForURL(/reflect\/[0-9a-f-]{36}$/, { timeout: 15000 });
await page.getByRole("button", { name: "Ask me a few questions" }).click();
await page.getByText("AI question").first().waitFor({ timeout: 15000 });
await page.screenshot({ path: out + "/22-entry.png", fullPage: true });
await page.goto("http://localhost:3000/reflect");
await page.waitForTimeout(800);
await page.screenshot({ path: out + "/23-reflect.png" });
await page.goto("http://localhost:3000/memory");
await page.waitForTimeout(800);
await page.screenshot({ path: out + "/24-ledger.png", fullPage: true });
await browser.close();
