-- Degree planner: one private row per student (grades, diploma track, transfers).
-- Apply after 0001_init.sql (`supabase db push` or the SQL editor).

create table public.degree_plans (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  track           text not null default 'ba' check (track in ('ba', 'dl')),
  nptel           integer not null default 0 check (nptel >= 0 and nptel <= 8),
  apprenticeship  integer not null default 0 check (apprenticeship >= 0 and apprenticeship <= 12),
  grades          jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.degree_plans enable row level security;

create policy "degree_plans: own row" on public.degree_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
