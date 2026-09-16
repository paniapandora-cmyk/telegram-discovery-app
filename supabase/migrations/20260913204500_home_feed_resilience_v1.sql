-- Keep Home populated even when the personalized slice is sparse.
-- The previous v9 implementation is preserved as v9_core; the public v9 RPC
-- becomes a compatibility wrapper that tops up from Explore and Trending.

do $$
begin
  if to_regprocedure('public.get_personalized_feed_v9_core(uuid,uuid,integer,integer)') is null
     and to_regprocedure('public.get_personalized_feed_v9(uuid,uuid,integer,integer)') is not null then
    execute 'alter function public.get_personalized_feed_v9(uuid,uuid,integer,integer) rename to get_personalized_feed_v9_core';
  end if;
end
$$;

create or replace function public.get_personalized_feed_v9(
  p_user_id uuid,
  p_session_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  content_id uuid,
  creator_id uuid,
  title text,
  description text,
  source_url text,
  thumbnail_url text,
  published_at timestamptz,
  score double precision,
  reason text,
  source_bucket text,
  feed_position integer
)
language sql
stable
set search_path to 'public'
as $function$
with params as (
  select
    greatest(least(coalesce(p_limit,20),100),1)::int as lim,
    greatest(coalesce(p_offset,0),0)::int as off
),
primary_feed as materialized (
  select *
  from public.get_personalized_feed_v9_core(
    p_user_id,
    p_session_id,
    (select lim from params),
    (select off from params)
  )
),
primary_ids as (
  select coalesce(array_agg(content_id),'{}'::uuid[]) as ids from primary_feed
),
explore_feed as materialized (
  select
    e.content_id,
    e.creator_id,
    e.title,
    e.description,
    e.source_url,
    c.thumbnail_url,
    e.published_at,
    e.score,
    'home_explore_topup'::text as reason,
    'home_topup'::text as source_bucket,
    row_number() over(order by e.score desc,e.published_at desc nulls last,e.content_id)::int as local_position
  from params p
  cross join primary_ids pi
  cross join lateral public.get_explore_discovery_page_v2(
    p_user_id,
    least(100,greatest(24,p.lim*3)),
    pi.ids
  ) e
  join public.contents c on c.id=e.content_id
  where p.off=0
    and (select count(*) from primary_feed) < p.lim
),
explore_ids as (
  select coalesce(array_agg(content_id),'{}'::uuid[]) as ids from explore_feed
),
trending_feed as materialized (
  select
    t.content_id,
    t.creator_id,
    t.title,
    t.description,
    t.source_url,
    c.thumbnail_url,
    t.published_at,
    t.score,
    'home_trending_topup'::text as reason,
    'home_topup'::text as source_bucket,
    row_number() over(order by t.score desc,t.published_at desc nulls last,t.content_id)::int as local_position
  from params p
  cross join primary_ids pi
  cross join explore_ids ei
  cross join lateral public.get_trending_discovery_v3(least(100,greatest(24,p.lim*3))) t
  join public.contents c on c.id=t.content_id
  where p.off=0
    and (select count(*) from primary_feed) + (select count(*) from explore_feed) < p.lim
    and not (t.content_id = any(pi.ids))
    and not (t.content_id = any(ei.ids))
    and not exists (
      select 1
      from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=t.content_id or (f.creator_id=t.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
),
combined as (
  select
    p.content_id,p.creator_id,p.title,p.description,p.source_url,p.thumbnail_url,p.published_at,
    p.score,p.reason,p.source_bucket,
    0::int as tier,
    p.feed_position::int as local_position
  from primary_feed p

  union all

  select
    e.content_id,e.creator_id,e.title,e.description,e.source_url,e.thumbnail_url,e.published_at,
    e.score,e.reason,e.source_bucket,
    1::int as tier,
    e.local_position
  from explore_feed e
  where not exists(select 1 from primary_feed p where p.content_id=e.content_id)

  union all

  select
    t.content_id,t.creator_id,t.title,t.description,t.source_url,t.thumbnail_url,t.published_at,
    t.score,t.reason,t.source_bucket,
    2::int as tier,
    t.local_position
  from trending_feed t
),
dedup as (
  select x.*
  from (
    select c.*,
      row_number() over(partition by c.content_id order by c.tier,c.local_position,c.score desc) as dupe_rank
    from combined c
  ) x
  where x.dupe_rank=1
),
ranked as (
  select d.*,
    row_number() over(order by d.tier,d.local_position,d.score desc,d.published_at desc nulls last,d.content_id)::int as final_position
  from dedup d
)
select
  r.content_id,r.creator_id,r.title,r.description,r.source_url,r.thumbnail_url,r.published_at,
  r.score,r.reason,r.source_bucket,r.final_position
from ranked r
order by r.final_position
limit (select lim from params);
$function$;

comment on function public.get_personalized_feed_v9(uuid,uuid,integer,integer)
is 'Home feed compatibility wrapper: personalized v9 core plus Explore/Trending top-up when the first page is sparse.';
