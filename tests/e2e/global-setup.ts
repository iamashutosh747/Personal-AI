import { execFileSync } from "node:child_process";
import pg from "pg";

/** Start every e2e run from an empty Inner World, on the local test stack only. */
export default async function globalSetup() {
  const env = Object.fromEntries(
    execFileSync("node", ["tests/stack/stack.mjs", "--env"]).toString().trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const url = env.DATABASE_URL!;
  if (!/@127\.0\.0\.1:54322\//.test(url)) throw new Error("Refusing to reset a database that is not the local test stack");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("delete from storage.objects");
  await client.query("delete from auth.users");
  await client.end();
}
