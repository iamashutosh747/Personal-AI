# The Inner World

A private digital sanctuary for one person: conversations with Claude that
remember only what you allow, a garden of memories, a quiet room to write in, a
self-portrait drawn in your own words, and letters sealed until the day you
choose.

- **Product architecture, schema and design directions:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Motion · Supabase (Postgres, Auth, Storage, pgvector) · Anthropic Claude API

---

## What works today

| Room | What you can do |
|---|---|
| **Sanctuary** | Time-of-day greeting, ask-anything field, a hand-written daily question, *A Moment From Then*, recently kept memories, a 14-day activity trace, notices for capsules ready to open |
| **Conversations** | Streaming replies from Claude; threads you can search, rename, archive and delete; per-thread memory (all / only chosen / none); a "Drew on N records" disclosure under every reply; "What do you remember about me?"; keep any message as a memory; turn a thread into a journal entry; **off-the-record** threads that are never written to the database |
| **Memory proposals** | Claude can *suggest* saving, correcting or forgetting a memory. Nothing changes until you approve, edit, or dismiss it |
| **Memory Garden** | 13 kinds of memory, photos and voice notes, dates, places, tags, categories, private/AI-visible switch, pinning, connections; timeline, archive search, calendar, and an interactive constellation (your links, shared tags, AI-suggested links awaiting approval); "Surprise me" |
| **Reflection Room** | Daily Reset, Deep Reflection, Unfiltered (never sent to the AI), Looking Back; autosave, focus mode, moods, voice typing; optional follow-up questions; weekly or monthly reflections whose every point cites the entries behind it and can be accepted, rejected or corrected |
| **The Mirror** | Values, interests, goals, favorites, milestones and priorities, each with dates; "then and now"; interests over time; most-used tags; AI pattern suggestions with sources that you may adopt in your own words |
| **Time Capsules** | Letter, goals, memories, voice and photos; sealing is enforced **by the database**, so a sealed letter cannot be read or edited until its date; an opening ceremony shows it exactly as written |
| **Memory Ledger** | Everything the AI can see, where each item came from, pending suggestions, all AI observations, and where your data goes |
| **Ambient worlds** | Midnight Library, Rainy Window, Quiet Observatory, Golden Hour, Deep Forest, Monochrome; optional clock-following light; optional generated ambient sound; motion off switch; honours reduced-motion |
| **Your data** | Export everything (ZIP with JSON and every photo and recording, or JSON only); delete everything permanently |
| **Everywhere** | Quick capture (`⌘/Ctrl J`), Compass navigation (`⌘/Ctrl K`), `g` + key shortcuts, mobile bottom bar, installable PWA |

### Honest limits

- **Not yet run against a hosted Supabase project or the live Claude API.**
  Everything was verified against real Postgres 16 + pgvector, Supabase Auth
  (v2.180) and PostgREST (v12), with a small Storage stand-in, and against a
  protocol-level mock of the Claude streaming API. Expect the first real run to
  surface small things; the setup steps below are what to follow.
- **Semantic search** turns on only with a `VOYAGE_API_KEY`, and only for
  memories saved after it is set. Without it, retrieval uses Postgres full-text
  search, which works well for most personal archives.
- **Voice typing** uses the browser's speech recognition (Chrome, Edge,
  Safari). Firefox shows a note suggesting your keyboard's dictation key.
- **HEIC photos** from iPhone display in Safari; other browsers may not show them.
- **Offline:** the installed app opens to an offline page without a
  connection. Your content is not cached on the device. That is a deliberate
  privacy choice for now.
- **Notifications** are in-app only (a banner when a capsule is ready). No push.
- Weekly and monthly reflections run when you ask, not on a schedule.

---

## Set it up (about 15 minutes)

You'll need **Node.js 20.9+** (22 recommended), a free **Supabase** account
and an **Anthropic API key**. Commands work the same on Windows (PowerShell)
and macOS/Linux.

### 1. Create the Supabase project

1. At [supabase.com/dashboard](https://supabase.com/dashboard), create a new
   project. Pick the region closest to you; that is where your data will live.
2. Apply the database schema, **either**:
   - **SQL editor (simplest):** open *SQL Editor*, and run each file in
     `supabase/migrations/` **in filename order** (paste the contents, press Run):
     1. `20261001000000_inner_world.sql`
     2. `20261001000100_storage.sql`
     3. `20261001000200_single_owner.sql`
   - **Supabase CLI:**
     ```bash
     npx supabase login
     npx supabase init        # keep the existing supabase/migrations folder
     npx supabase link --project-ref YOUR-PROJECT-REF
     npx supabase db push
     ```
3. *Authentication → URL Configuration*: set **Site URL** to
   `http://localhost:3000` for now (change it to your deployed address later).
4. Optional, for a one-person app: *Authentication → Sign In / Providers →
   Email*, turn off **Confirm email** so you can sign in immediately. If you
   leave it on, confirm via the email Supabase sends.

### 2. Configure the app

```bash
cp .env.example .env.local      # Windows: copy .env.example .env.local
```

Fill in `.env.local`. **Keep these values out of chats, screenshots and commits;
`.env.local` is already git-ignored.**

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page: the **anon / publishable** key (safe in the browser; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. Same page: the **service_role / secret** key. Used only to remove your login when you choose *Delete everything*. Server only. |
| `ALLOWED_EMAILS` | The email you'll sign up with |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5-5`. `claude-sonnet-5-5` costs about half as much |
| `CLAUDE_EFFORT` | `low`, `medium` (default) or `high`: how much Claude thinks before replying |
| `VOYAGE_API_KEY` | Optional, from [voyageai.com](https://www.voyageai.com), for semantic memory search |

### 3. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, choose **Create your space** with the email from
`ALLOWED_EMAILS`, and answer (or skip) the onboarding questions.

**One owner only.** After the first account exists, the database refuses any
further sign-up, even through the raw Auth API. To allow a second address of
your own, run in the SQL editor:

```sql
insert into public.signup_allowlist (email) values ('other@example.com');
```

---

## Use it on your iPhone and Windows PC

The app must be reachable over HTTPS. The simplest host is **Vercel**:

1. Push this repository to GitHub, then *Add New → Project* in Vercel and import it.
2. Add the same environment variables from `.env.local` in the Vercel project settings.
3. Deploy. Then in Supabase, set **Site URL** (and *Redirect URLs*) to your Vercel address.

Then:

- **iPhone:** open the address in **Safari** → Share → **Add to Home Screen**.
  It opens full screen, like an app.
- **Windows:** open it in **Edge** or **Chrome** → the install icon in the
  address bar (or ⋯ → *Apps* → *Install*).

---

## Where your information goes

- **Supabase (your project):** everything you keep. Every table has row-level
  security; photos and recordings are in a private bucket under your user id.
- **Anthropic:** when you talk with Claude or ask for a reflection, the text
  needed for that request (your message, recent conversation, and the records
  listed under the reply) is sent to the Claude API. Anthropic does not train on
  API data by default.
- **Voyage AI (only if configured):** memory text, to build search vectors.
- Nothing else. No analytics, advertising or tracking. AI-generated text is
  always stored separately from your own words, and labelled.

---

## Tests

```bash
npm run typecheck && npm run lint
npm test                    # unit tests: retrieval formatting, rediscovery, validation, zip, media sniffing, time
```

The integration and end-to-end suites run against a **local Supabase-compatible
stack** (`tests/stack/stack.mjs`: system Postgres 16+ with pgvector, Supabase
Auth and PostgREST binaries it downloads, and a small Storage stand-in) plus a
mock Claude API (`tests/mock-anthropic.mjs`). They need Linux with
`postgresql-16` and `postgresql-16-pgvector` installed.

```bash
npm run stack:reset         # terminal 1: start a fresh local stack
npm run test:integration    # RLS isolation, sealed capsules, sign-up guard, quotas, storage privacy, deletion
npx playwright install chromium
npm run test:e2e            # the whole journey in a real browser, from sign-up to "delete everything"
```

Current results: 28 unit, 10 integration and 16 end-to-end tests, all passing.

---

## Project layout

```
docs/ARCHITECTURE.md        product vision, sitemap, schema, design directions, plan
supabase/migrations/        the database: tables, RLS, functions, storage, sign-up guard
src/app/(app)/              the rooms (Sanctuary, talk, garden, reflect, mirror, capsules, memory, settings)
src/app/api/                chat (streaming), reflect, mirror, garden link suggestions, media, export, account
src/lib/ai/                 Claude client, persona prompt, context retrieval, memory tools, structured output
src/lib/actions/            server actions per domain
src/components/             UI by room, plus shell and primitives
tests/                      unit, integration, e2e, the local stack and the mock Claude API
```

## What's next

1. First run against your real Supabase project and Claude key; tune the
   persona prompt and effort level from real conversations.
2. Backfill embeddings for existing memories when a Voyage key is added.
3. Scheduled weekly reflections (opt-in) and push notifications for capsules.
4. A Content-Security-Policy header and an encrypted on-device cache for offline reading.
