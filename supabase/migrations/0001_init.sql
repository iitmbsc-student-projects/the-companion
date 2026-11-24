-- The Companion: accounts, sync, enrollments, scores and suggestions.
-- Run with `supabase db push` (or paste into the SQL editor of the project).
-- Everything is protected with row-level security; the anon key alone can read
-- and write nothing. See supabase/README.md for the one-time project setup.

-- ---------------------------------------------------------------- profiles
create type public.user_role as enum ('student', 'moderator', 'admin');

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_iitm      boolean not null default false,
  role         public.user_role not null default 'student',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- a profile row is created automatically on first sign-in; the verified email
-- domain decides the "IITM student" badge shown in the moderation queue.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_iitm)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '') ~* '@(ds|es)\.study\.iitm\.ac\.in$'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role helpers: SECURITY DEFINER so RLS policies can consult profiles without
-- recursing into profiles' own policies.
create or replace function public.current_role_of(uid uuid)
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = uid), 'student');
$$;

create or replace function public.is_moderator()
returns boolean language sql security definer set search_path = public stable
as $$ select public.current_role_of(auth.uid()) in ('moderator', 'admin'); $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select public.current_role_of(auth.uid()) = 'admin'; $$;

-- users read and edit their own profile, but can never change their own role
-- or is_iitm flag; only an admin can change roles (including their own).
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_moderator());

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only an admin can change roles';
    end if;
    if new.is_iitm is distinct from old.is_iitm then
      raise exception 'is_iitm is set from the verified email only';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ------------------------------------------------------------- enrollments
-- "My Term": the courses a student is taking this term.
create table public.enrollments (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  term        text not null,
  course_code text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, term, course_code)
);

alter table public.enrollments enable row level security;

create policy "enrollments: own rows" on public.enrollments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -------------------------------------------------------- lecture_progress
-- One row per watched lecture. lecture_key keeps the exact format the site
-- already uses in localStorage (assets/course.js): "Week 1|1.4", with an
-- optional "#k" suffix for duplicate numbers inside a week.
create table public.lecture_progress (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_code text not null,
  lecture_key text not null,
  watched_at  timestamptz not null default now(),
  primary key (user_id, course_code, lecture_key)
);

create index lecture_progress_user on public.lecture_progress (user_id);

alter table public.lecture_progress enable row level security;

create policy "progress: own rows" on public.lecture_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ scores
-- Private quiz/assignment marks for the reverse grade calculator.
create table public.scores (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  term        text not null,
  course_code text not null,
  inputs      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, term, course_code)
);

alter table public.scores enable row level security;

create policy "scores: own rows" on public.scores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------- suggestions
create type public.suggestion_kind as enum ('new_resource', 'broken_link', 'correction');
create type public.suggestion_status as enum ('pending', 'approved', 'rejected', 'merged');

create table public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_code text not null,
  kind        public.suggestion_kind not null,
  payload     jsonb not null default '{}'::jsonb,
  status      public.suggestion_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  review_note text,
  pr_url      text,
  created_at  timestamptz not null default now()
);

create index suggestions_status on public.suggestions (status, created_at desc);

alter table public.suggestions enable row level security;

-- students: insert their own, read their own. Moderators: read everything.
create policy "suggestions: insert own" on public.suggestions
  for insert with check (user_id = auth.uid() and status = 'pending'
                         and reviewer_id is null and pr_url is null);

create policy "suggestions: read own or moderator" on public.suggestions
  for select using (user_id = auth.uid() or public.is_moderator());

-- moderators may reject from the client; approvals only go through the
-- approve-suggestion Edge Function (service role), which re-checks the role.
create policy "suggestions: moderator reject" on public.suggestions
  for update using (public.is_moderator())
  with check (status in ('pending', 'rejected') and reviewer_id = auth.uid());

-- rate limit: at most 20 pending suggestions per user.
create or replace function public.limit_pending_suggestions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.suggestions
      where user_id = new.user_id and status = 'pending') >= 20 then
    raise exception 'you already have 20 suggestions waiting for review';
  end if;
  return new;
end;
$$;

create trigger limit_pending_suggestions
  before insert on public.suggestions
  for each row execute function public.limit_pending_suggestions();

-- -------------------------------------------------------- account deletion
-- "Delete my account" on account.html: removes the auth user; every table
-- above cascades from profiles, and profiles cascades from auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
