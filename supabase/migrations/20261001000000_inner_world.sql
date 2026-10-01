-- The Inner World — core schema
-- Every user-owned table: user_id -> auth.users (cascade), RLS on, owner-only policies.
-- Ownership across tables is enforced with composite foreign keys (id, user_id),
-- so a row can never point at another person's record.

create extension if not exists vector with schema extensions;

-- ─────────────────────────────────────────────────────────────── helpers

create or replace function public.tags_to_text(tags text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_to_string(tags, ' '), '')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────── profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  space_name text not null default 'The Inner World' check (char_length(space_name) between 1 and 80),
  conversation_style text not null default 'balanced'
    check (conversation_style in ('balanced', 'concise', 'expansive', 'socratic', 'playful')),
  modules text[] not null default array['talk', 'garden', 'reflect', 'mirror', 'capsules'],
  ambient_world text not null default 'midnight-library'
    check (ambient_world in ('midnight-library', 'rainy-window', 'quiet-observatory', 'golden-hour', 'deep-forest', 'monochrome')),
  auto_world boolean not null default false,
  motion boolean not null default true,
  sound boolean not null default false,
  default_ai_access boolean not null default true,
  journal_ai_access boolean not null default false,
  never_share_tags text[] not null default '{}',
  rediscovery_frequency text not null default 'daily'
    check (rediscovery_frequency in ('daily', 'weekly', 'off')),
  rediscovery_kinds text[] not null default array['reflection', 'event', 'experience', 'idea', 'goal', 'relationship', 'favorite', 'place', 'photo', 'lesson', 'conversation'],
  timezone text not null default 'UTC',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────── memories

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'reflection' check (kind in (
    'reflection', 'event', 'experience', 'idea', 'goal', 'relationship',
    'favorite', 'place', 'photo', 'future_message', 'preference', 'lesson', 'other'
  )),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  occurred_on date,
  location text check (char_length(location) <= 200),
  tags text[] not null default '{}',
  category text check (char_length(category) <= 60),
  ai_access boolean not null default true,
  pinned boolean not null default false,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'conversation', 'journal', 'proposal', 'import', 'capture')),
  source_id uuid,
  source_excerpt text check (char_length(source_excerpt) <= 4000),
  last_surfaced_at timestamptz,
  embedding extensions.vector(1024),
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', public.tags_to_text(tags) || ' ' || coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '') || ' ' || coalesce(location, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index memories_user_created on public.memories (user_id, created_at desc);
create index memories_user_occurred on public.memories (user_id, occurred_on);
create index memories_fts on public.memories using gin (fts);
create index memories_tags on public.memories using gin (tags);
create trigger memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

-- Constellation edges. Stored undirected: a link a–b is the same as b–a.
create table public.memory_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_id uuid not null,
  to_id uuid not null,
  origin text not null default 'manual' check (origin in ('manual', 'ai_suggested')),
  status text not null default 'approved' check (status in ('approved', 'suggested', 'rejected')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  foreign key (from_id, user_id) references public.memories (id, user_id) on delete cascade,
  foreign key (to_id, user_id) references public.memories (id, user_id) on delete cascade
);
create unique index memory_links_pair on public.memory_links
  (user_id, least(from_id, to_id), greatest(from_id, to_id));

-- ─────────────────────────────────────────────────────────────── journal

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null default 'unfiltered'
    check (mode in ('daily_reset', 'deep', 'unfiltered', 'looking_back')),
  title text check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 100000),
  mood text check (char_length(mood) <= 40),
  prompt text check (char_length(prompt) <= 500),
  ai_access boolean not null default false,
  revisits_id uuid,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (revisits_id, user_id) references public.journal_entries (id, user_id) on delete set null (revisits_id)
);
create index journal_user_created on public.journal_entries (user_id, created_at desc);
create index journal_fts on public.journal_entries using gin (fts);
create trigger journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────── conversations

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled conversation' check (char_length(title) between 1 and 200),
  archived boolean not null default false,
  memory_mode text not null default 'all' check (memory_mode in ('all', 'chosen', 'none')),
  chosen_memory_ids uuid[] not null default '{}',
  ai_access boolean not null default false,
  journal_entry_id uuid,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (journal_entry_id, user_id) references public.journal_entries (id, user_id) on delete set null (journal_entry_id)
);
create index conversations_user_recent on public.conversations (user_id, archived, last_message_at desc);
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 100000),
  context_memory_ids uuid[] not null default '{}',
  context_entry_ids uuid[] not null default '{}',
  context_message_ids uuid[] not null default '{}',
  model text,
  stop_reason text,
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (conversation_id, user_id) references public.conversations (id, user_id) on delete cascade
);
create index messages_conversation on public.messages (conversation_id, created_at);
create index messages_fts on public.messages using gin (fts);

-- ─────────────────────────────────────────────────────────────── proposals & observations

create table public.memory_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null default 'create' check (action in ('create', 'update', 'forget')),
  target_memory_id uuid,
  kind text check (kind in (
    'reflection', 'event', 'experience', 'idea', 'goal', 'relationship',
    'favorite', 'place', 'photo', 'future_message', 'preference', 'lesson', 'other'
  )),
  title text check (char_length(title) <= 200),
  body text check (char_length(body) <= 20000),
  tags text[] not null default '{}',
  reason text check (char_length(reason) <= 1000),
  source_type text not null check (source_type in ('conversation', 'journal')),
  source_id uuid,
  source_excerpt text check (char_length(source_excerpt) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (target_memory_id, user_id) references public.memories (id, user_id) on delete cascade
);
create index proposals_user_status on public.memory_proposals (user_id, status, created_at desc);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope text not null check (scope in ('journal', 'mirror', 'weekly', 'monthly', 'entry')),
  kind text not null check (kind in ('theme', 'priority_shift', 'pattern', 'summary', 'question', 'connection')),
  label text not null check (label in ('observation', 'hypothesis')),
  statement text not null check (char_length(statement) between 1 and 4000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'corrected')),
  correction text check (char_length(correction) <= 4000),
  entry_id uuid,
  period_start date,
  period_end date,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (entry_id, user_id) references public.journal_entries (id, user_id) on delete cascade
);
create index observations_user on public.observations (user_id, scope, created_at desc);
create trigger observations_touch before update on public.observations
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────── the mirror

create table public.self_attributes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('value', 'interest', 'goal', 'favorite', 'milestone', 'priority')),
  label text not null check (char_length(label) between 1 and 200),
  detail text check (char_length(detail) <= 2000),
  rank smallint check (rank between 1 and 99),
  since date not null default current_date,
  until date,
  origin text not null default 'self' check (origin in ('self', 'observation')),
  observation_id uuid references public.observations (id) on delete set null,
  ai_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (until is null or until >= since)
);
create index self_attributes_user on public.self_attributes (user_id, kind, until);
create trigger self_attributes_touch before update on public.self_attributes
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────── time capsules

create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  letter text not null default '' check (char_length(letter) <= 50000),
  open_at timestamptz not null,
  sealed_at timestamptz,
  opened_at timestamptz,
  memory_ids uuid[] not null default '{}',
  goals text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index capsules_user on public.capsules (user_id, open_at);

-- A sealed capsule is immutable, except for recording when it was opened.
create or replace function public.guard_sealed_capsule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.sealed_at is not null then
    if new.letter is distinct from old.letter
      or new.title is distinct from old.title
      or new.open_at is distinct from old.open_at
      or new.sealed_at is distinct from old.sealed_at
      or new.memory_ids is distinct from old.memory_ids
      or new.goals is distinct from old.goals then
      raise exception 'A sealed capsule cannot be changed' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger capsules_guard before update on public.capsules
  for each row execute function public.guard_sealed_capsule();

-- ─────────────────────────────────────────────────────────────── media

create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  memory_id uuid,
  capsule_id uuid,
  journal_entry_id uuid,
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null unique,
  mime text not null check (mime ~ '^(image|audio)/[a-z0-9.+-]+$'),
  bytes integer not null check (bytes > 0 and bytes <= 26214400),
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  check (num_nonnulls(memory_id, capsule_id, journal_entry_id) = 1),
  check (storage_path like (user_id::text || '/%')),
  foreign key (memory_id, user_id) references public.memories (id, user_id) on delete cascade,
  foreign key (capsule_id, user_id) references public.capsules (id, user_id) on delete cascade,
  foreign key (journal_entry_id, user_id) references public.journal_entries (id, user_id) on delete cascade
);
create index media_memory on public.media (memory_id);
create index media_capsule on public.media (capsule_id);

create or replace function public.guard_capsule_media()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.capsule_id is not null and exists (
    select 1 from public.capsules c where c.id = new.capsule_id and c.sealed_at is not null
  ) then
    raise exception 'A sealed capsule cannot be changed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger media_capsule_guard before insert or update on public.media
  for each row execute function public.guard_capsule_media();

-- ─────────────────────────────────────────────────────────────── AI usage (rate limiting)

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_time on public.ai_usage (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────── row level security

alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.memory_links enable row level security;
alter table public.journal_entries enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memory_proposals enable row level security;
alter table public.observations enable row level security;
alter table public.self_attributes enable row level security;
alter table public.capsules enable row level security;
alter table public.media enable row level security;
alter table public.ai_usage enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'memories', 'memory_links', 'journal_entries', 'conversations', 'messages',
    'memory_proposals', 'observations', 'self_attributes', 'capsules', 'media'
  ] loop
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create policy "read own usage" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;

-- A capsule's letter is never readable through the table: drafts and opened
-- letters are read through read_capsule(), which refuses sealed, unopened ones.
revoke select on public.capsules from authenticated;
grant select (id, user_id, title, open_at, sealed_at, opened_at, memory_ids, goals, created_at, updated_at)
  on public.capsules to authenticated;

-- ─────────────────────────────────────────────────────────────── functions

-- Rate limit for AI calls. Returns false (and records nothing) when over quota.
create or replace function public.consume_ai_quota(p_kind text, p_per_minute int, p_per_day int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  minute_count int;
  day_count int;
begin
  if uid is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select count(*) filter (where created_at > now() - interval '1 minute'),
         count(*) filter (where created_at > now() - interval '1 day')
    into minute_count, day_count
    from public.ai_usage
   where user_id = uid and created_at > now() - interval '1 day';
  if minute_count >= p_per_minute or day_count >= p_per_day then
    return false;
  end if;
  insert into public.ai_usage (user_id, kind) values (uid, p_kind);
  delete from public.ai_usage where user_id = uid and created_at < now() - interval '2 days';
  return true;
end;
$$;

-- Read a capsule's letter: drafts always, sealed letters only once due.
-- Opening a due capsule records opened_at the first time.
create or replace function public.read_capsule(p_id uuid)
returns table (id uuid, title text, letter text, open_at timestamptz, sealed_at timestamptz, opened_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.capsules;
begin
  select * into c from public.capsules where capsules.id = p_id and capsules.user_id = auth.uid();
  if not found then
    raise exception 'Capsule not found' using errcode = 'P0002';
  end if;
  if c.sealed_at is not null and now() < c.open_at then
    raise exception 'This capsule is sealed until %', c.open_at using errcode = 'P0001';
  end if;
  if c.sealed_at is not null and c.opened_at is null then
    update public.capsules set opened_at = now() where capsules.id = c.id returning * into c;
  end if;
  return query select c.id, c.title, c.letter, c.open_at, c.sealed_at, c.opened_at;
end;
$$;

-- Every capsule letter, for the user's own data export.
create or replace function public.export_capsule_letters()
returns table (id uuid, letter text)
language sql
security definer
set search_path = ''
as $$
  select c.id, c.letter from public.capsules c where c.user_id = auth.uid()
$$;

-- Context retrieval for conversations. Runs as the caller: RLS limits it to
-- the caller's rows, and the explicit filters limit it to AI-visible rows.
create or replace function public.retrieve_context(
  p_query text,
  p_embedding extensions.vector(1024) default null,
  p_memory_mode text default 'all',
  p_chosen uuid[] default '{}',
  p_exclude_conversation uuid default null,
  p_limit int default 8
)
returns table (
  source text,
  id uuid,
  kind text,
  title text,
  body text,
  occurred_on date,
  created_at timestamptz,
  tags text[],
  score real
)
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  q tsquery;
  blocked text[];
begin
  if uid is null or p_memory_mode = 'none' then
    return;
  end if;

  select coalesce(p.never_share_tags, '{}') into blocked from public.profiles p where p.id = uid;
  blocked := coalesce(blocked, '{}');

  -- OR the query's lexemes together so partial overlap still counts.
  begin
    q := nullif(replace(plainto_tsquery('english', coalesce(p_query, ''))::text, ' & ', ' | '), '')::tsquery;
  exception when others then
    q := null;
  end;

  if p_memory_mode = 'chosen' then
    return query
      select 'memory'::text, m.id, m.kind, m.title, m.body, m.occurred_on, m.created_at, m.tags, 1.0::real
        from public.memories m
       where m.user_id = uid and m.id = any (p_chosen)
       order by m.occurred_on desc nulls last, m.created_at desc
       limit greatest(p_limit, 1) * 3;
    return;
  end if;

  return query
  with mem as (
    select 'memory'::text as source, m.id, m.kind, m.title, m.body, m.occurred_on, m.created_at, m.tags,
           (
             case when q is not null then ts_rank_cd(m.fts, q, 32) * 2.0 else 0 end
             + case when p_embedding is not null and m.embedding is not null
                    then greatest(0, 1 - (m.embedding operator(extensions.<=>) p_embedding)) * 1.5 else 0 end
             + case when m.pinned then 0.25 else 0 end
             + case when m.kind = 'preference' then 0.2 else 0 end
             + 0.15 * exp(-extract(epoch from now() - m.created_at) / (86400.0 * 365))
           )::real as score,
           (q is not null and m.fts @@ q) as matched,
           (p_embedding is not null and m.embedding is not null
             and 1 - (m.embedding operator(extensions.<=>) p_embedding) > 0.45) as near
      from public.memories m
     where m.user_id = uid
       and m.ai_access
       and not (m.tags && blocked)
  ),
  jrn as (
    select 'journal'::text, j.id, j.mode, coalesce(j.title, 'Journal entry'), left(j.body, 1500), j.created_at::date, j.created_at, '{}'::text[],
           (ts_rank_cd(j.fts, q, 32) * 1.6 + 0.1 * exp(-extract(epoch from now() - j.created_at) / (86400.0 * 180)))::real
      from public.journal_entries j
     where j.user_id = uid and j.ai_access and q is not null and j.fts @@ q
     order by 9 desc
     limit 4
  ),
  msg as (
    select 'message'::text, mm.id, mm.role, c.title, left(mm.content, 800), mm.created_at::date, mm.created_at, '{}'::text[],
           (ts_rank_cd(mm.fts, q, 32) * 1.2)::real
      from public.messages mm
      join public.conversations c on c.id = mm.conversation_id
     where mm.user_id = uid and c.ai_access
       and (p_exclude_conversation is null or c.id <> p_exclude_conversation)
       and q is not null and mm.fts @@ q
     order by 9 desc
     limit 3
  )
  select * from (
    select mem.source, mem.id, mem.kind, mem.title, mem.body, mem.occurred_on, mem.created_at, mem.tags, mem.score
      from mem
     where mem.matched or mem.near or mem.kind = 'preference'
    union all
    select * from jrn
    union all
    select * from msg
  ) ranked
  order by ranked.score desc
  limit p_limit;
end;
$$;

-- Permanently delete everything the caller has stored. Runs as the caller, so
-- RLS guarantees it can only touch their own rows. Storage objects are removed
-- by the app through the Storage API, and the auth account itself through the
-- Auth admin API (see app/api/account/route.ts).
create or replace function public.delete_my_data()
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from public.media where user_id = uid;
  delete from public.memory_links where user_id = uid;
  delete from public.memory_proposals where user_id = uid;
  delete from public.self_attributes where user_id = uid;
  delete from public.observations where user_id = uid;
  delete from public.messages where user_id = uid;
  delete from public.conversations where user_id = uid;
  delete from public.capsules where user_id = uid;
  delete from public.memories where user_id = uid;
  delete from public.journal_entries where user_id = uid;
  delete from public.profiles where id = uid;
end;
$$;

revoke execute on function public.consume_ai_quota(text, int, int) from public, anon;
revoke execute on function public.read_capsule(uuid) from public, anon;
revoke execute on function public.export_capsule_letters() from public, anon;
revoke execute on function public.retrieve_context(text, extensions.vector, text, uuid[], uuid, int) from public, anon;
revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.consume_ai_quota(text, int, int) to authenticated;
grant execute on function public.read_capsule(uuid) to authenticated;
grant execute on function public.export_capsule_letters() to authenticated;
grant execute on function public.retrieve_context(text, extensions.vector, text, uuid[], uuid, int) to authenticated;
grant execute on function public.delete_my_data() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
