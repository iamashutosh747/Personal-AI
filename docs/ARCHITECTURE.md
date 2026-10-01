# The Inner World — Product Architecture & Creative Direction

> Phase 1 deliverable. This document is the source of truth for what the product
> is, how it is built, and what is implemented versus planned. The
> "Implementation status" section at the end is updated at each milestone.

---

## 1. Product vision

**The Inner World is a private room that remembers only what you hand it.**

It is one person's sanctuary: a place to think out loud with an AI, keep the
things that matter, write without being watched, and later find your own past
waiting for you. It never pretends to know you better than you do. Every memory it
uses, you saved or approved. Every pattern it suggests is labelled as a
suggestion and points back to the words that prompted it.

Three ideas run through the whole product:

1. **Consent-shaped memory.** Nothing becomes a memory silently. The AI can
   *propose* a memory; you decide. Each memory records where it came from and
   whether the AI may read it.
2. **Your words stay your words.** Journal entries, letters and capsules are
   never rewritten. AI output always sits in its own labelled layer
   (observation, hypothesis, summary), separate from your original writing.
3. **Quiet by design.** The app does not nag, does not fill empty space with
   fabricated "insights", and does not start conversations on its own. When
   there is nothing to show, it shows a well-made empty room.

### Creative direction — "A lamp left on"

The default world is a late-evening study: deep ink and graphite, one warm
pool of amber light, editorial serif type, generous dark space. Motion behaves
like light changing, not like UI moving: slow fades, gentle parallax in the
ambient layer, and none of it is required to use the app.

Typography carries the identity:

| Role | Face | Why |
|---|---|---|
| Display | *Instrument Serif* (incl. italic) | Literary, high-contrast, unmistakably not a SaaS app |
| Reading & writing | *Newsreader* | Built for long-form screen reading; journal entries and letters feel like pages |
| Interface | *Inter Tight* | Compact and neutral, so the serif faces carry the character |

---

## 2. Sitemap & navigation model

```
/signin                      Private entry (email + password, allow-listed)
/welcome                     Onboarding (every question skippable)

/                            THE SANCTUARY — greeting, ask-anything, today's prompt,
                             "A Moment From Then", recent memories, ready capsules
/talk                        CONVERSATION SPACE — threads, search, archive
/talk/[id]                   A conversation (streaming, memory-aware)
/garden                      MEMORY GARDEN — timeline · archive · constellation · calendar
/garden/new                  Write / upload / record a memory
/garden/[id]                 One memory: edit, links, media, AI access
/reflect                     REFLECTION ROOM — modes + journal history
/reflect/write?mode=…        Daily Reset · Deep Reflection · Unfiltered · Looking Back
/reflect/[id]                One entry (+ labelled AI layer)
/mirror                      THE MIRROR — self-described profile, change over time, observations
/capsules                    TIME CAPSULE — sealed archive & opened letters
/capsules/new                Write a letter to the future
/capsules/[id]               Open / read a capsule
/memory                      MEMORY LEDGER — everything the AI can see, sources, proposals
/settings                    Personalisation, ambient world, privacy, export, delete
```

**Navigation.** No permanent sidebar.

- **Desktop:** a small mark top-left opens the *Compass*, a full-screen,
  keyboard-driven overlay listing the rooms. Shortcuts: `⌘/Ctrl K` Compass,
  `⌘/Ctrl J` quick capture, `g` then `t / g / r / m / c / l` to jump to a room.
- **Mobile:** a slim bottom bar with five targets (Sanctuary, Talk, Garden,
  Reflect, Capture) sitting in the safe area. Everything else is in the Compass.
- **Quick capture** works from anywhere and saves a memory or journal fragment
  in two taps.

---

## 3. Feature breakdown — MVP vs. later

| Module | MVP (built now) | Later |
|---|---|---|
| **Sanctuary** | Time-aware greeting, central ask field, deterministic daily prompt, recent memories, *A Moment From Then*, ready capsules, pending memory proposals count | Seasonal ambient changes, milestone markers |
| **Conversation Space** | Threads, streaming Claude replies, persistence, search, rename / archive / delete, save a message as a memory, conversation → journal entry, retrieval of approved memories with a "what informed this" disclosure, per-thread memory control (all / chosen / none), off-the-record threads, "What do you remember about me?", AI-proposed memories & corrections that need approval | Conversation summaries as retrievable memories, attachments in chat |
| **Memory Garden** | 13 memory kinds, manual write, save from chat / journal, photo upload, voice recording, date / place / tags / category, AI-access toggle, manual links, timeline, archive search, constellation (manual + shared-tag + approved AI links), calendar, random discovery | AI-suggested links queue, map view |
| **Reflection Room** | Four modes, optional mood, optional prompts, voice-to-text (where the browser supports it), search, AI follow-up questions (opt-in per entry), weekly / monthly reflection summaries as labelled observations | Guided multi-step sessions, streak-free gentle reminders |
| **The Mirror** | Self-described attributes (values, interests, goals, favourites, milestones, priorities) with start/end dates, current vs. past priorities, AI pattern suggestions with sources, approve / reject / correct | Interest timelines as charts |
| **Time Capsule** | Write, attach memories & goals, record audio, seal (immutable in the database), unopened archive (letter not readable before its date), in-app notice, ceremonial open | Milestone-triggered capsules |
| **Ambient World** | Six worlds (Midnight Library, Rainy Window, Quiet Observatory, Golden Hour, Deep Forest, Monochrome), optional generated ambient sound, motion / sound / auto-theme switches, respects `prefers-reduced-motion` | Per-world photography packs |
| **Memory Engine** | Six-way separation, proposals queue, provenance, full-text + recency + tag ranking, optional pgvector semantic search (Voyage embeddings), ledger UI, export, full deletion | Hybrid re-ranking, memory consolidation suggestions |
| **Platform** | Supabase auth with email allow-list, RLS on every table, private storage bucket, DB-backed AI rate limits, PWA manifest + service worker (shell only) | Push notifications, local encrypted cache |

---

## 4. Technical architecture

```
 iPhone (PWA) / Windows browser
        │  HTTPS, Supabase session cookie (httpOnly)
        ▼
 ┌──────────────────────────── Next.js 16 (App Router) ────────────────────────────┐
 │  Server Components ── read data with the *user's* Supabase session (RLS applies) │
 │  Server Actions   ── mutations (memories, journal, capsules, settings)          │
 │  Route Handlers   ── /api/chat (SSE stream), /api/reflect, /api/mirror,         │
 │                      /api/media, /api/export, /api/account                      │
 │  proxy.ts         ── refreshes the session cookie, gates private routes         │
 │                                                                                 │
 │  lib/ai/*         ── Claude client, persona prompt, context builder, tools      │
 │  lib/memory/*     ── retrieval (RPC), embeddings (optional), proposals          │
 └───────────────┬─────────────────────────────────────┬───────────────────────────┘
                 │ anon key + user JWT                 │ ANTHROPIC_API_KEY (server only)
                 ▼                                     ▼
 ┌──────────── Supabase ────────────┐         ┌──────── Anthropic API ────────┐
 │ Auth (email+password)            │         │ Messages API, streaming,      │
 │ Postgres + RLS + pgvector        │         │ tool use for memory proposals │
 │ RPC: retrieve_context,           │         └───────────────────────────────┘
 │      consume_ai_quota,           │         ┌──── Voyage AI (optional) ─────┐
 │      read_capsule, delete_my_data│         │ embeddings for semantic recall│
 │ Storage: private "media" bucket  │         └───────────────────────────────┘
 └──────────────────────────────────┘
```

**How a conversation turn works**

1. The browser posts `{conversationId, text}` to `/api/chat`.
2. The route checks the session and calls `consume_ai_quota` (a per-kind rate
   limit kept in Postgres, so it works on serverless hosts).
3. It stores your message, then calls `retrieve_context(query, …)`, which
   searches **only** rows you own that are marked AI-visible and that the
   thread's memory setting allows. Ranking blends full-text relevance,
   optional vector similarity, tag overlap, pinned status and recency.
4. It builds the request: a stable, cached persona system prompt; the thread
   history; your new message; then a *mid-conversation system message* that
   carries the retrieved memories, each with its id, kind and date.
5. Claude streams back. If it calls `propose_memory` or
   `propose_memory_correction`, the server stores a **pending proposal**. It
   never writes a memory directly. The loop continues until Claude finishes.
6. The assistant message is saved with the ids of the memories it was given,
   so "What informed this?" is exact, not reconstructed.

**Why these choices**

- *Supabase over local-only.* You want the same world on iPhone and Windows.
  A hosted Postgres with RLS gives you real isolation, backups and auth without
  running a server. Data is stored in your Supabase project's region. Text
  sent to Claude is processed by Anthropic under their API terms; API inputs
  are not used for training by default.
- *Full-text first, vectors optional.* Postgres `tsvector` retrieval is
  reliable, free and explainable. Semantic search with pgvector switches on when
  `VOYAGE_API_KEY` is present (Anthropic does not ship an embeddings model; Voyage
  is the provider Anthropic recommends). The schema is ready either way.
- *Proposals via tool use, not background extraction.* Claude proposes a
  memory in context, where it can explain why, and you approve it in one tap.
  No hidden pipeline mines your chats.
- *Every query runs as you.* RLS is the security boundary. The service-role
  key has one optional use: removing the login itself when you choose
  "Delete everything" (your rows are deleted as you, under RLS, and your files
  through the Storage API, before it is used).

---

## 5. Database schema (summary)

Full DDL: `supabase/migrations/`. Every table has `user_id` → `auth.users` with
`on delete cascade`, RLS enabled, and owner-only policies.

| Table | Purpose | Notable columns |
|---|---|---|
| `profiles` | Personalisation & privacy defaults | `space_name`, `display_name`, `conversation_style`, `ambient_world`, `motion`, `sound`, `auto_world`, `default_ai_access`, `rediscovery_frequency`, `rediscovery_kinds[]`, `onboarded_at` |
| `memories` | Explicit memories & preferences | `kind`, `title`, `body`, `occurred_on`, `location`, `tags[]`, `category`, `ai_access`, `pinned`, `source_type`, `source_id`, `source_excerpt`, `fts`, `embedding vector(1024)` |
| `memory_links` | Constellation edges | `from_id`, `to_id`, `origin (manual / ai_suggested)`, `status (approved / suggested / rejected)`, `note` |
| `media` | Photos & audio in private storage | `owner_type (memory / capsule / journal)`, `owner_id`, `kind`, `storage_path`, `mime`, `bytes` |
| `conversations` | Threads | `title`, `archived`, `memory_mode (all / chosen / none)`, `chosen_memory_ids[]`, `ai_access` (may past messages be recalled), `journal_entry_id` |
| `messages` | Original conversation record | `role`, `content`, `context_memory_ids[]`, `context_entry_ids[]`, `model`, `fts` |
| `journal_entries` | Original reflections | `mode`, `title`, `body`, `mood`, `prompt`, `ai_access`, `revisits_id`, `fts` |
| `memory_proposals` | Candidates awaiting approval | `action (create / update / forget)`, `target_memory_id`, `title`, `body`, `kind`, `tags[]`, `reason`, `source_type`, `source_id`, `status` |
| `observations` | AI-generated patterns & summaries | `kind`, `label (observation / hypothesis)`, `statement`, `sources jsonb` (ids + excerpts), `status (pending / accepted / rejected / corrected)`, `correction`, `period_start/end` |
| `self_attributes` | The Mirror | `kind (value / interest / goal / favourite / milestone / priority)`, `label`, `detail`, `rank`, `since`, `until`, `origin (self / observation)` |
| `capsules` | Letters to the future | `title`, `letter` (column-hidden; read only through `read_capsule`), `open_at`, `sealed_at`, `opened_at`, `memory_ids[]`, `goals[]` |
| `ai_usage` | Rate limiting | `kind`, `created_at` |
| `signup_allowlist` | Extra addresses allowed to sign up after the owner | `email` (no API access) |

**Six-way memory separation, mapped to storage**

| Category | Where |
|---|---|
| Explicit memories | `memories` (kinds other than `preference`) |
| Personal preferences | `memories.kind = 'preference'` |
| Conversation history | `conversations` + `messages` (original text) |
| Journal entries | `journal_entries` (original text) |
| AI observations | `observations`; never mixed into the tables above |
| Temporary context | Off-the-record threads: never written to the database |

---

## 6. Three visual directions

### A. Midnight Library — *default*
Ink `#0d0f14`, graphite `#171a21`, lamplight amber `#d9a35b`, warm ivory text
`#ece6da`. Serif-forward, editorial. A soft amber glow sits behind the greeting
and drifts slowly. Dust-mote grain overlay. It feels like a desk lamp in a
dark room, built for writing at night.

### B. Quiet Observatory
Midnight navy `#0a1020`, slate `#1a2236`, lavender `#a99be0`, cold blue
`#7fa2d6`. A sparse, slowly rotating star field. The constellation view is at
home here. Thin, wide-tracked caps for labels. Contemplative and spacious, more
about wonder than comfort.

### C. Rainy Window
Warm graphite `#121315`, mist `#1c1f23`, muted blue `#8fa8bf`, ivory `#efe9df`.
Fine vertical rain streaks behind frosted text panels, with an optional soft
rain sound. Intimate and slightly melancholic, good for long reflection.

All three ship as *worlds* alongside **Golden Hour**, **Deep Forest** and
**Minimalist Monochrome**. Choosing one only swaps colour tokens and the ambient
layer, so the components stay the same. The default direction is **A**.

---

## 7. Phased implementation plan

| Phase | Milestone | Exit criteria |
|---|---|---|
| 1 | This document | Architecture, schema, directions agreed |
| 2 | Visual foundation | Shell, Compass, worlds, Sanctuary, onboarding, sign-in run against a real database |
| 3 | Core experience | Memories, journal and conversation CRUD persist with RLS; search works |
| 4 | Claude | Streaming chat, retrieval with disclosure, proposals, reflection AI with labelled output |
| 5 | Advanced | Mirror, capsules, constellation, rediscovery, sound, voice, export & delete, PWA |
| 6 | Hardening | Unit tests, SQL isolation tests, end-to-end flows, a11y pass, docs |

See the root `README.md` for the current implementation status and setup.
