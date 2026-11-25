-- View counts, visitor counts, and course ratings.
-- Counts move only through the two functions below. Every page load counts as
-- a visit, including a refresh. A person is counted once. A course view counts
-- once per person per day.
-- Ratings are one per signed-in person per course. Aggregates are public;
-- who rated what is not.

create table public.site_stats (
  id       int primary key default 1 check (id = 1),
  visits   bigint not null default 0,
  visitors bigint not null default 0
);

insert into public.site_stats (id, visits, visitors) values (1, 669, 203);

create table public.visitors (
  id         uuid primary key,
  first_seen date not null default (timezone('utc', now()))::date
);

-- Caps how many brand-new visitor ids one network can mint in a day.
create table public.visitor_ip_day (
  ip_hash text not null,
  day     date not null,
  n       int not null default 0,
  primary key (ip_hash, day)
);

create table public.daily_visits (
  visitor_id uuid not null references public.visitors (id) on delete cascade,
  day        date not null,
  primary key (visitor_id, day)
);

create table public.course_stats (
  course_code  text primary key,
  views        bigint not null default 0,
  rating_sum   int not null default 0,
  rating_count int not null default 0,
  constraint course_stats_code check (course_code ~ '^[A-Z]{2,3}[0-9]{4}P?$')
);

create table public.daily_course_views (
  visitor_id  uuid not null references public.visitors (id) on delete cascade,
  course_code text not null,
  day         date not null,
  primary key (visitor_id, course_code, day)
);

create table public.course_ratings (
  course_code text not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (course_code, user_id),
  constraint course_ratings_code check (course_code ~ '^[A-Z]{2,3}[0-9]{4}P?$')
);

alter table public.site_stats enable row level security;
alter table public.visitors enable row level security;
alter table public.visitor_ip_day enable row level security;
alter table public.daily_visits enable row level security;
alter table public.course_stats enable row level security;
alter table public.daily_course_views enable row level security;
alter table public.course_ratings enable row level security;

revoke all on public.site_stats, public.visitors, public.visitor_ip_day,
  public.daily_visits, public.course_stats, public.daily_course_views,
  public.course_ratings
  from public, anon, authenticated;

create or replace function public.stats_payload(p_course text, p_full boolean)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_visits bigint;
  v_visitors bigint;
  v_views bigint;
  v_sum int;
  v_count int;
  v_mine int;
  v_popular jsonb;
  v_courses jsonb;
begin
  select visits, visitors into v_visits, v_visitors from public.site_stats where id = 1;
  if p_course is not null then
    select views, rating_sum, rating_count
      into v_views, v_sum, v_count
      from public.course_stats where course_code = p_course;
    if auth.uid() is not null then
      select stars into v_mine from public.course_ratings
        where course_code = p_course and user_id = auth.uid();
    end if;
  end if;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.views desc, t.rating_count desc), '[]'::jsonb)
    into v_popular
    from (
      select course_code as code, views,
             case when rating_count = 0 then null
                  else round(rating_sum::numeric / rating_count, 1) end as rating_avg,
             rating_count
        from public.course_stats
       where views > 0
       order by views desc, rating_count desc
       limit 6
    ) t;
  if p_full then
    select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      into v_courses
      from (
        select course_code as code, views,
               case when rating_count = 0 then null
                    else round(rating_sum::numeric / rating_count, 1) end as rating_avg,
               rating_count
          from public.course_stats
         where views > 0 or rating_count > 0
      ) t;
  end if;
  return jsonb_build_object(
    'visits', coalesce(v_visits, 0),
    'visitors', coalesce(v_visitors, 0),
    'views', v_views,
    'rating_avg', case when coalesce(v_count, 0) = 0 then null
                       else round(v_sum::numeric / v_count, 1) end,
    'rating_count', coalesce(v_count, 0),
    'my_stars', v_mine,
    'popular', coalesce(v_popular, '[]'::jsonb),
    'courses', v_courses
  );
end;
$$;

create or replace function public.record_traffic(
  p_visitor uuid,
  p_course text default null,
  p_full boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_headers json;
  v_ip text := '';
  v_known boolean;
  v_allowed boolean := true;
  v_rows int;
begin
  if p_course is not null and p_course !~ '^[A-Z]{2,3}[0-9]{4}P?$' then
    p_course := null;
  end if;

  select exists(select 1 from public.visitors where id = p_visitor) into v_known;

  if not v_known then
    begin
      v_headers := nullif(current_setting('request.headers', true), '')::json;
    exception when others then
      v_headers := null;
    end;
    if v_headers is not null then
      v_ip := left(btrim(coalesce(
        v_headers->>'cf-connecting-ip',
        split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)
      )), 80);
    end if;
    if v_ip <> '' then
      insert into public.visitor_ip_day as d (ip_hash, day, n)
      values (md5(v_ip), v_day, 1)
      on conflict (ip_hash, day) do update
        set n = d.n + 1
        where d.n < 2000;
      get diagnostics v_rows = row_count;
      v_allowed := v_rows > 0;
    end if;
    if v_allowed then
      insert into public.visitors (id) values (p_visitor) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        update public.site_stats set visitors = visitors + 1 where id = 1;
      end if;
    end if;
  end if;

  select exists(select 1 from public.visitors where id = p_visitor) into v_known;
  if v_known then
    update public.site_stats set visits = visits + 1 where id = 1;
    if p_course is not null then
      insert into public.daily_course_views (visitor_id, course_code, day)
      values (p_visitor, p_course, v_day) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        insert into public.course_stats (course_code, views)
        values (p_course, 1)
        on conflict (course_code) do update
          set views = public.course_stats.views + 1;
      end if;
    end if;
  end if;

  return public.stats_payload(p_course, p_full);
end;
$$;

create or replace function public.rate_course(p_course text, p_stars int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_sum int;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'sign in to rate a course';
  end if;
  if p_course is null or p_course !~ '^[A-Z]{2,3}[0-9]{4}P?$' then
    raise exception 'unknown course';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'rating must be from 1 to 5';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_course));

  insert into public.course_ratings (course_code, user_id, stars)
  values (p_course, auth.uid(), p_stars)
  on conflict (course_code, user_id) do update
    set stars = excluded.stars, updated_at = now();

  select coalesce(sum(stars), 0), count(*)::int
    into v_sum, v_count
    from public.course_ratings
   where course_code = p_course;

  insert into public.course_stats (course_code, rating_sum, rating_count)
  values (p_course, v_sum, v_count)
  on conflict (course_code) do update
    set rating_sum = excluded.rating_sum,
        rating_count = excluded.rating_count;

  return public.stats_payload(p_course, false);
end;
$$;

revoke all on function public.stats_payload(text, boolean) from public, anon, authenticated;
revoke all on function public.record_traffic(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.rate_course(text, int) from public, anon, authenticated;
grant execute on function public.record_traffic(uuid, text, boolean) to anon, authenticated;
grant execute on function public.rate_course(text, int) to authenticated;
