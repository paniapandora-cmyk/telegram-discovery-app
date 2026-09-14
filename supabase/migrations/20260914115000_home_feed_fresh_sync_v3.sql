-- Home must prefer content that can plausibly reflect the current Telegram sync.
-- Personalized content is capped at 7 days, followed creators at 30 days.
-- Sparse first pages are topped up from fresh Explore/Trending candidates.

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
    greatest(coalesce(p_offset,0),0)::int as off,
    least(100,greatest(48,(greatest(least(coalesce(p_limit,20),100),1)+greatest(coalesce(p_offset,0),0))*4))::int as pool_lim
),
primary_pool as materialized (
  select p.*
  from params x
  cross join lateral public.get_personalized_feed_v9_core(
    p_user_id,
    p_session_id,
    x.pool_lim,
    0
  ) p
),
primary_fresh_ranked as materialized (
  select p.*,
    row_number() over(order by p.feed_position,p.score desc,p.published_at desc nulls last,p.content_id)::int as fresh_position
  from primary_pool p
  where p.published_at is not null
    and p.published_at >= now() - case when p.source_bucket='followed' then interval '30 days' else interval '7 days' end
),
primary_page as materialized (
  select
    p.content_id,p.creator_id,p.title,p.description,p.source_url,p.thumbnail_url,p.published_at,
    p.score,p.reason,p.source_bucket,
    (p.fresh_position-(select off from params))::int as local_position
  from primary_fresh_ranked p
  cross join params x
  where p.fresh_position > x.off
    and p.fresh_position <= x.off+x.lim
),
primary_ids as (
  select coalesce(array_agg(content_id),'{}'::uuid[]) as ids from primary_page
),
explore_raw as materialized (
  select e.*
  from params x
  cross join primary_ids pi
  cross join lateral public.get_explore_discovery_page_v2(
    p_user_id,
    100,
    pi.ids
  ) e
  where x.off=0
    and (select count(*) from primary_page) < x.lim
    and e.published_at is not null
    and e.published_at >= now()-interval '14 days'
),
explore_feed as materialized (
  select
    e.content_id,e.creator_id,e.title,e.description,e.source_url,c.thumbnail_url,e.published_at,e.score,
    'home_explore_fresh_topup'::text as reason,
    'home_topup'::text as source_bucket,
    row_number() over(order by e.score desc,e.published_at desc nulls last,e.content_id)::int as local_position
  from explore_raw e
  join public.contents c on c.id=e.content_id
  where not exists(select 1 from primary_page p where p.content_id=e.content_id)
),
explore_ids as (
  select coalesce(array_agg(content_id),'{}'::uuid[]) as ids from explore_feed
),
trending_raw as materialized (
  select t.*
  from params x
  cross join lateral public.get_trending_discovery_v3(100) t
  where x.off=0
    and (select count(*) from primary_page)+(select count(*) from explore_feed) < x.lim
    and t.published_at is not null
    and t.published_at >= now()-interval '14 days'
),
trending_feed as materialized (
  select
    t.content_id,t.creator_id,t.title,t.description,t.source_url,c.thumbnail_url,t.published_at,t.score,
    'home_trending_fresh_topup'::text as reason,
    'home_topup'::text as source_bucket,
    row_number() over(order by t.score desc,t.published_at desc nulls last,t.content_id)::int as local_position
  from trending_raw t
  join public.contents c on c.id=t.content_id
  cross join primary_ids pi
  cross join explore_ids ei
  where not (t.content_id=any(pi.ids))
    and not (t.content_id=any(ei.ids))
    and not exists (
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=t.content_id or (f.creator_id=t.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
),
combined as (
  select p.content_id,p.creator_id,p.title,p.description,p.source_url,p.thumbnail_url,p.published_at,
         p.score,p.reason,p.source_bucket,0::int tier,p.local_position
  from primary_page p
  union all
  select e.content_id,e.creator_id,e.title,e.description,e.source_url,e.thumbnail_url,e.published_at,
         e.score,e.reason,e.source_bucket,1::int tier,e.local_position
  from explore_feed e
  union all
  select t.content_id,t.creator_id,t.title,t.description,t.source_url,t.thumbnail_url,t.published_at,
         t.score,t.reason,t.source_bucket,2::int tier,t.local_position
  from trending_feed t
),
dedup as (
  select z.*
  from (
    select c.*,row_number() over(partition by c.content_id order by c.tier,c.local_position,c.score desc) dupe_rank
    from combined c
  ) z
  where z.dupe_rank=1
),
ranked as (
  select d.*,
    row_number() over(order by d.tier,d.local_position,d.score desc,d.published_at desc nulls last,d.content_id)::int as final_position
  from dedup d
)
select r.content_id,r.creator_id,r.title,r.description,r.source_url,r.thumbnail_url,r.published_at,
       r.score,r.reason,r.source_bucket,r.final_position
from ranked r
order by r.final_position
limit (select lim from params);
$function$;

comment on function public.get_personalized_feed_v9(uuid,uuid,integer,integer)
is 'Fresh Home feed wrapper: personalized content <=7d, followed content <=30d, fresh Explore/Trending top-up <=14d.';
