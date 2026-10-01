#!/usr/bin/env node
// A small, self-contained Supabase-compatible stack for tests on Linux machines
// without Docker: Postgres (system install) + Supabase Auth (GoTrue) +
// PostgREST + a gateway with a minimal Storage API. It applies the real
// migrations in supabase/migrations, so RLS is exercised exactly as written.
//
// For everyday local development use the Supabase CLI (`supabase start`)
// instead; see README.md. This harness exists so automated tests can run in
// sandboxes and CI runners where Docker images are unavailable.
//
//   node tests/stack/stack.mjs          start (foreground; Ctrl+C to stop)
//   node tests/stack/stack.mjs --reset  wipe data first
//   node tests/stack/stack.mjs --env    print the env vars the app needs
//   node tests/stack/stack.mjs --stop   stop a running stack

import { spawn, execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const home = path.join(repo, ".stack");
const binDir = path.join(home, "bin");
const dataDir = path.join(home, "pgdata");
const storageDir = path.join(home, "storage");
const sockDir = path.join(home, "sock");

const PORTS = { pg: 54322, auth: 54329, rest: 54330, gateway: 54321 };
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const AUTH_VERSION = "v2.180.0";
const POSTGREST_VERSION = "v12.2.3";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, b, s] = token.split(".");
  if (!h || !b || !s) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
  if (expected !== s) return null;
  const claims = JSON.parse(Buffer.from(b, "base64url").toString());
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

const longExp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10;
export const ANON_KEY = signJwt({ iss: "supabase-demo", role: "anon", exp: longExp });
export const SERVICE_KEY = signJwt({ iss: "supabase-demo", role: "service_role", exp: longExp });

const env = {
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTS.gateway}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  DATABASE_URL: `postgres://postgres@127.0.0.1:${PORTS.pg}/postgres`,
};

const pidFile = path.join(home, "stack.pid");
if (process.argv.includes("--stop")) {
  try {
    process.kill(Number(fs.readFileSync(pidFile, "utf8")), "SIGTERM");
    console.log("[stack] stopping");
  } catch {
    console.log("[stack] not running");
  }
  process.exit(0);
}

if (process.argv.includes("--env")) {
  for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
  process.exit(0);
}

function pgBin(name) {
  if (process.env.PG_BIN) return path.join(process.env.PG_BIN, name);
  const base = "/usr/lib/postgresql";
  const versions = fs.existsSync(base) ? fs.readdirSync(base).sort().reverse() : [];
  for (const v of versions) {
    const p = path.join(base, v, "bin", name);
    if (fs.existsSync(p)) return p;
  }
  return name;
}

function download(url, dest) {
  console.log(`[stack] downloading ${url}`);
  execFileSync("curl", ["-fsSL", "-o", dest, url], { stdio: "inherit" });
}

function ensureBinaries() {
  fs.mkdirSync(binDir, { recursive: true });
  const auth = path.join(binDir, "auth");
  if (!fs.existsSync(auth)) {
    const tgz = path.join(binDir, "auth.tar.gz");
    download(`https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-x86.tar.gz`, tgz);
    execFileSync("tar", ["xzf", tgz, "-C", binDir]);
  }
  const rest = path.join(binDir, "postgrest");
  if (!fs.existsSync(rest)) {
    const txz = path.join(binDir, "postgrest.tar.xz");
    download(`https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x64.tar.xz`, txz);
    execFileSync("tar", ["xJf", txz, "-C", binDir]);
  }
}

const children = [];
function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
  const log = fs.createWriteStream(path.join(home, `${name}.log`), { flags: "a" });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code) => {
    if (!shuttingDown) console.error(`[stack] ${name} exited (${code}); see .stack/${name}.log`);
  });
  children.push(child);
  return child;
}

async function waitFor(check, label, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      if (await check()) return;
    } catch {}
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

function psql(args, input) {
  return execFileSync(pgBin("psql"), ["-h", "127.0.0.1", "-p", String(PORTS.pg), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args], {
    input,
    encoding: "utf8",
  });
}

let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  for (const c of children.reverse()) c.kill("SIGINT");
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ───────────────────────────── storage shim

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 4 });

async function asUser(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [
      claims.role === "service_role" ? "service_role" : "authenticated",
      JSON.stringify(claims),
    ]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function storage(req, res, rest) {
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const claims = verifyJwt(auth);
  if (!claims || claims.role === "anon") return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "Unauthorized" });
  const segments = rest.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== "object") return json(res, 404, { message: "not supported by test storage" });
  segments.shift();
  if (segments[0] === "authenticated") segments.shift();

  try {
    if (req.method === "DELETE") {
      const bucket = segments[0];
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
      const rows = await asUser(claims, async (c) =>
        (await c.query("delete from storage.objects where bucket_id = $1 and name = any($2) returning name", [bucket, prefixes])).rows,
      );
      for (const r of rows) fs.rmSync(path.join(storageDir, bucket, r.name), { force: true });
      return json(res, 200, rows.map((r) => ({ name: r.name, bucket_id: bucket })));
    }
    if (segments[0] === "list") {
      const bucket = segments[1];
      const { prefix = "" } = JSON.parse((await readBody(req)).toString() || "{}");
      const rows = await asUser(claims, async (c) =>
        (await c.query("select id, name, metadata, created_at from storage.objects where bucket_id = $1 and name like $2", [bucket, `${prefix.replace(/\/$/, "")}/%`])).rows,
      );
      return json(res, 200, rows.map((r) => ({ ...r, name: r.name.slice(prefix.replace(/\/$/, "").length + 1) })));
    }
    const [bucket, ...rest2] = segments;
    const name = rest2.join("/");
    if (req.method === "POST" || req.method === "PUT") {
      const body = await readBody(req);
      const mime = req.headers["content-type"] || "application/octet-stream";
      const row = await asUser(claims, async (c) =>
        (
          await c.query(
            `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
             on conflict (bucket_id, name) do update set metadata = excluded.metadata returning id`,
            [bucket, name, claims.sub, { mimetype: mime, size: body.length }],
          )
        ).rows[0],
      );
      const file = path.join(storageDir, bucket, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      return json(res, 200, { Key: `${bucket}/${name}`, Id: row.id });
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const row = await asUser(claims, async (c) =>
        (await c.query("select metadata from storage.objects where bucket_id = $1 and name = $2", [bucket, name])).rows[0],
      );
      if (!row) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      res.writeHead(200, { "content-type": row.metadata?.mimetype || "application/octet-stream" });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(path.join(storageDir, bucket, name)).pipe(res);
    }
    return json(res, 405, { message: "method not allowed" });
  } catch (e) {
    return json(res, 400, { statusCode: "403", error: "Unauthorized", message: String(e.message || e) });
  }
}

// ───────────────────────────── gateway

function proxyTo(port, req, res, pathRest) {
  const upstream = http.request(
    { host: "127.0.0.1", port, method: req.method, path: pathRest || "/", headers: { ...req.headers, host: `127.0.0.1:${port}` } },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (e) => json(res, 502, { message: String(e) }));
  req.pipe(upstream);
}

function startGateway() {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
    if (req.method === "OPTIONS") return res.end();
    if (url.startsWith("/auth/v1")) return proxyTo(PORTS.auth, req, res, url.slice("/auth/v1".length));
    if (url.startsWith("/rest/v1")) return proxyTo(PORTS.rest, req, res, url.slice("/rest/v1".length));
    if (url.startsWith("/storage/v1/")) return storage(req, res, url.slice("/storage/v1/".length));
    json(res, 404, { message: "unknown route" });
  });
  return new Promise((resolve) => server.listen(PORTS.gateway, "127.0.0.1", resolve));
}

// ───────────────────────────── main

async function main() {
  if (process.argv.includes("--reset")) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(sockDir, { recursive: true });
  fs.writeFileSync(pidFile, String(process.pid));
  ensureBinaries();

  // Postgres refuses to run as root; drop to the "postgres" OS user if needed.
  const pgOpts = process.getuid?.() === 0 ? { uid: Number(execFileSync("id", ["-u", "postgres"]).toString().trim()) } : {};
  if (pgOpts.uid !== undefined) {
    fs.mkdirSync(dataDir, { recursive: true });
    execFileSync("chown", ["postgres", dataDir, sockDir]);
  }
  const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) {
    execFileSync(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-instructions"], { stdio: "ignore", ...pgOpts });
  }
  const pgArgs = ["-D", dataDir, "-p", String(PORTS.pg), "-k", sockDir, "-c", "listen_addresses=127.0.0.1"];
  run("postgres", pgBin("postgres"), pgArgs, pgOpts);
  await waitFor(() => {
    execFileSync(pgBin("pg_isready"), ["-h", "127.0.0.1", "-p", String(PORTS.pg)], { stdio: "ignore" });
    return true;
  }, "postgres");

  psql(["-f", path.join(here, "bootstrap.sql")]);

  run("auth", path.join(binDir, "auth"), [], {
    env: {
      ...process.env,
      GOTRUE_API_HOST: "127.0.0.1",
      PORT: String(PORTS.auth),
      API_EXTERNAL_URL: `http://127.0.0.1:${PORTS.gateway}/auth/v1`,
      GOTRUE_DB_DRIVER: "postgres",
      DATABASE_URL: `postgres://supabase_auth_admin:auth@127.0.0.1:${PORTS.pg}/postgres?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_DB_MIGRATIONS_PATH: path.join(binDir, "migrations"),
      GOTRUE_SITE_URL: "http://localhost:3000",
      GOTRUE_URI_ALLOW_LIST: "*",
      GOTRUE_JWT_SECRET: JWT_SECRET,
      GOTRUE_JWT_EXP: "3600",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_MAILER_AUTOCONFIRM: "true",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_LOG_LEVEL: "warn",
    },
  });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORTS.auth}/health`)).ok, "auth", 60000);

  // Apply app migrations once, in order.
  psql([], "create table if not exists public._stack_migrations (name text primary key, applied_at timestamptz default now());");
  const applied = new Set(psql(["-At", "-c", "select name from public._stack_migrations"]).split("\n").filter(Boolean));
  const migrations = fs.readdirSync(path.join(repo, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migrations) {
    if (applied.has(m)) continue;
    console.log(`[stack] applying ${m}`);
    psql(["-1", "-f", path.join(repo, "supabase/migrations", m)]);
    psql(["-c", `insert into public._stack_migrations (name) values ('${m}')`]);
  }
  psql([], "revoke all on public._stack_migrations from anon, authenticated;");

  run("postgrest", path.join(binDir, "postgrest"), [], {
    env: {
      ...process.env,
      PGRST_DB_URI: `postgres://authenticator:authenticator@127.0.0.1:${PORTS.pg}/postgres`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_PORT: String(PORTS.rest),
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_DB_EXTRA_SEARCH_PATH: "public, extensions",
    },
  });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORTS.rest}/`)).status < 500, "postgrest");

  await startGateway();
  console.log(`[stack] ready on ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (process.send) process.send({ ready: true, env });
}

main().catch((e) => {
  console.error(e);
  shutdown();
  process.exitCode = 1;
});

export { randomUUID };
