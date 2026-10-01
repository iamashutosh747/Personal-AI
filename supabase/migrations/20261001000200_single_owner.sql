-- The Inner World is a one-person space. The first account to sign up becomes
-- the owner; after that, sign-ups are refused unless the address has been
-- added to signup_allowlist (e.g. a second address of your own):
--
--   insert into public.signup_allowlist (email) values ('me@example.com');
--
-- The allow-list has RLS enabled and no policies, so it is not reachable from
-- the public API. Enforcing this in the database means it cannot be bypassed by
-- calling the Auth API directly with the public anon key.

create table public.signup_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

create or replace function public.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users)
     and not exists (select 1 from public.signup_allowlist a where a.email = lower(new.email)) then
    raise exception 'Sign-ups are closed for this Inner World' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_signup() from public, anon, authenticated;

create trigger guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup();
