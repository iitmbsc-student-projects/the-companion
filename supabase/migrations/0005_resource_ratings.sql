-- One rating per signed-in person per resource link. The average is public.
-- Who rated a link is not.

create table public.resource_ratings (
  resource_url text not null,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  course_code  text not null,
  stars        smallint not null check (stars between 1 and 5),
  updated_at   timestamptz not null default now(),
  primary key (resource_url, user_id),
  constraint resource_ratings_url check (resource_url ~ '^https?://' and length(resource_url) <= 500),
  constraint resource_ratings_code check (course_code ~ '^[A-Z]{2,3}[0-9]{4}P?$')
);

alter table public.resource_ratings enable row level security;
revoke all on public.resource_ratings from public, anon, authenticated;

create or replace function public.resource_scores(p_urls text[])
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if p_urls is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'url', u.url,
      'rating_avg', case when c.n = 0 then null else round(c.s::numeric / c.n, 1) end,
      'rating_count', c.n,
      'my_stars', c.mine
    )), '[]'::jsonb)
    into v
    from (
      select left(x, 500) as url
        from unnest(p_urls) as x
       where x ~ '^https?://'
       limit 80
    ) u
    join lateral (
      select coalesce(sum(stars), 0) as s,
             count(*)::int as n,
             max(stars) filter (where user_id = auth.uid()) as mine
        from public.resource_ratings r
       where r.resource_url = u.url
    ) c on c.n > 0;
  return v;
end;
$$;

create or replace function public.rate_resource(p_course text, p_url text, p_stars int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_sum int;
  v_count int;
  v_mine int;
begin
  if auth.uid() is null then
    raise exception 'sign in to rate a resource';
  end if;
  if p_course is null or p_course !~ '^[A-Z]{2,3}[0-9]{4}P?$' then
    raise exception 'unknown course';
  end if;
  if p_url is null or p_url !~ '^https?://' or length(p_url) > 500 then
    raise exception 'that link cannot be rated';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'rating must be from 1 to 5';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_url));

  insert into public.resource_ratings (resource_url, user_id, course_code, stars)
  values (p_url, auth.uid(), p_course, p_stars)
  on conflict (resource_url, user_id) do update
    set stars = excluded.stars,
        course_code = excluded.course_code,
        updated_at = now();

  select coalesce(sum(stars), 0), count(*)::int
    into v_sum, v_count
    from public.resource_ratings
   where resource_url = p_url;

  v_mine := p_stars;
  return jsonb_build_object(
    'url', p_url,
    'rating_avg', round(v_sum::numeric / v_count, 1),
    'rating_count', v_count,
    'my_stars', v_mine
  );
end;
$$;

revoke all on function public.resource_scores(text[]) from public, anon, authenticated;
revoke all on function public.rate_resource(text, text, int) from public, anon, authenticated;
grant execute on function public.resource_scores(text[]) to anon, authenticated;
grant execute on function public.rate_resource(text, text, int) to authenticated;
