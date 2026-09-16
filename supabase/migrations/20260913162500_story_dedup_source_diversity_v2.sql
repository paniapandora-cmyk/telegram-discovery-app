-- Story-level duplicate suppression and creator diversity for Home / Explore / Trending.
-- Designed for the larger Telegram source corpus introduced by telegram-public-sync-v1.

create or replace function public.discovery_story_key_v1(
  p_content_id uuid,
  p_title text,
  p_description text,
  p_text_content text
)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  v text;
begin
  v := lower(translate(
    coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' || coalesce(p_text_content,''),
    'يىكۀة', 'ییکهه'
  ));
  v := regexp_replace(v, 'https?://[^[:space:]]+', ' ', 'gi');
  v := regexp_replace(v, 't\.me/[^[:space:]]+', ' ', 'gi');
  v := regexp_replace(v, '@[a-z0-9_]{4,32}', ' ', 'gi');
  v := regexp_replace(v, '[^[:alnum:]آ-ی]+', '', 'g');
  if length(v) < 48 then
    return 'content:' || p_content_id::text;
  end if;
  return 'story:' || md5(left(v, 320));
end;
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
as $$
with params as (
  select greatest(least(p_limit,100),1) as lim,
         greatest(p_offset,0) as off,
         least(160,greatest(70,(greatest(least(p_limit,100),1)+greatest(p_offset,0))*6)) as candidate_limit
),
base_feed as materialized (
  select f.*
  from params p
  cross join lateral public.get_personalized_feed_v8(p_user_id,p_session_id,p.candidate_limit,0) f
),
follow_source as materialized (
  select c.id as content_id,c.creator_id,c.title,c.description,c.source_url,c.thumbnail_url,c.published_at,
         least(1.0,greatest(0.0,
           0.30*coalesce(cf.normalized_quality,coalesce(c.quality_score,0.5))+
           0.16*coalesce(cf.substance_score,public.discovery_content_substance_score(c.id),0.5)+
           0.24*public.discovery_freshness_factor(c.published_at)+
           0.12*coalesce(cf.engagement_score,0)+
           0.18*least(1,greatest(0,public.semantic_content_score(p_user_id,c.id)))
         ))::double precision as score,
         'followed_creator'::text as reason,'followed'::text as source_bucket,0::integer as feed_position
  from public.follows fol
  join public.creators cr on cr.id=fol.creator_id
  join public.contents c on c.creator_id=fol.creator_id
  left join public.discovery_content_features cf on cf.content_id=c.id
  where fol.user_id=p_user_id
    and coalesce(cr.is_active,true)=true
    and coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and coalesce(cf.normalized_quality,coalesce(c.quality_score,0.5))>=0.32
    and not exists (
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=c.id or (f.creator_id=c.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
    and not (p_session_id is not null and exists(
      select 1 from public.impressions i where i.session_id=p_session_id and i.content_id=c.id
    ))
),
combined as (
  select * from base_feed
  union all
  select * from follow_source
),
dedup as (
  select x.* from (
    select c.*,row_number() over(
      partition by c.content_id
      order by (c.source_bucket='followed') desc,c.score desc,c.published_at desc nulls last
    ) as dupe_rank
    from combined c
  ) x where x.dupe_rank=1
),
activity_adjusted as (
  select d.*,activity.last_seen_at,coalesce(activity.recent_views,0) as recent_views,
         (d.source_bucket='followed' or exists(
           select 1 from public.follows fol where fol.user_id=p_user_id and fol.creator_id=d.creator_id
         )) as followed_creator,
         greatest(0,least(1,
           d.score+
           case when (d.source_bucket='followed' or exists(
             select 1 from public.follows fol where fol.user_id=p_user_id and fol.creator_id=d.creator_id
           )) then 0.14 else 0 end-
           case
             when activity.last_seen_at>=now()-interval '12 hours' then 0.45
             when activity.last_seen_at>=now()-interval '3 days' then 0.18
             when activity.last_seen_at>=now()-interval '14 days' then 0.07
             else 0
           end-
           least(0.12,coalesce(activity.recent_views,0)*0.025)
         ))::double precision as adjusted_score
  from dedup d
  left join lateral (
    select max(e.created_at) as last_seen_at,
           count(*) filter(where e.created_at>=now()-interval '30 days')::integer as recent_views
    from public.events e
    where e.user_id=p_user_id and e.content_id=d.content_id
      and upper(e.event_type) in ('OPEN','VIEW','LONG_VIEW')
      and e.created_at>=now()-interval '90 days'
  ) activity on true
),
creator_diverse as (
  select a.*,
         row_number() over(partition by a.creator_id order by a.adjusted_score desc,a.published_at desc nulls last,a.content_id) as creator_rank
  from activity_adjusted a
),
eligible as (
  select d.*,
         greatest(0,d.adjusted_score-least(0.28,0.055*greatest(d.creator_rank-1,0)))::double precision as final_score
  from creator_diverse d
  where not d.followed_creator or d.creator_rank<=5
),
story_keyed as (
  select e.*,
         public.discovery_story_key_v1(c.id,c.title,c.description,c.text_content) as story_key
  from eligible e
  join public.contents c on c.id=e.content_id
),
story_dedup as (
  select s.*,
         row_number() over(partition by s.story_key order by s.final_score desc,s.published_at desc nulls last,s.content_id) as story_rank
  from story_keyed s
),
page_diverse as (
  select s.*,
         row_number() over(partition by s.creator_id order by s.final_score desc,s.published_at desc nulls last,s.content_id) as page_creator_rank
  from story_dedup s
  where s.story_rank=1
),
ranked as (
  select e.*,
         row_number() over(order by e.final_score desc,e.published_at desc nulls last,e.content_id)::integer as final_position
  from page_diverse e
  where e.page_creator_rank <= case when e.followed_creator then 4 else 3 end
)
select r.content_id,r.creator_id,r.title,r.description,r.source_url,r.thumbnail_url,r.published_at,
       r.final_score,
       case
         when r.followed_creator and r.last_seen_at is null then r.reason||'_followed_storydiverse'
         when r.followed_creator then r.reason||'_followed_freshened_storydiverse'
         when r.last_seen_at is null then r.reason||'_storydiverse'
         else r.reason||'_freshened_storydiverse'
       end as reason,
       r.source_bucket,r.final_position
from ranked r
order by r.final_position
limit greatest(least(p_limit,100),1)
offset greatest(p_offset,0);
$$;

create or replace function public.get_explore_discovery_v5(
  p_user_id uuid,
  p_limit integer default 25,
  p_exclude uuid[] default '{}'::uuid[]
)
returns table(content_id uuid,creator_id uuid,title text,description text,source_url text,published_at timestamptz,score double precision)
language sql
stable security definer
set search_path to 'public'
as $$
with base as materialized (
  select b.*
  from public.get_explore_discovery_v4(
    p_user_id,
    least(101,greatest(50,least(coalesce(p_limit,25),100)*5)),
    p_exclude
  ) b
),
keyed as (
  select b.*, public.discovery_story_key_v1(c.id,c.title,c.description,c.text_content) as story_key
  from base b join public.contents c on c.id=b.content_id
),
story_dedup as (
  select k.*, row_number() over(partition by story_key order by score desc,published_at desc nulls last,content_id) as story_rank
  from keyed k
),
creator_diverse as (
  select s.*, row_number() over(partition by creator_id order by score desc,published_at desc nulls last,content_id) as creator_rank
  from story_dedup s where story_rank=1
),
ranked as (
  select c.*, greatest(0,c.score - 0.045*greatest(c.creator_rank-1,0)) as final_score
  from creator_diverse c
  where c.creator_rank<=2
)
select content_id,creator_id,title,description,source_url,published_at,final_score
from ranked
order by final_score desc,published_at desc nulls last,content_id
limit greatest(least(coalesce(p_limit,25),100),1);
$$;

create or replace function public.get_explore_discovery_v2(p_user_id uuid,p_limit integer default 20)
returns table(content_id uuid,creator_id uuid,title text,description text,source_url text,published_at timestamptz,score double precision)
language sql stable security definer set search_path to 'public'
as $$ select * from public.get_explore_discovery_v5(p_user_id,p_limit,'{}'::uuid[]); $$;

create or replace function public.get_explore_discovery_page_v1(p_user_id uuid,p_limit integer default 25,p_exclude uuid[] default '{}'::uuid[])
returns table(content_id uuid,creator_id uuid,title text,description text,source_url text,published_at timestamptz,score double precision)
language sql stable security definer set search_path to 'public'
as $$ select * from public.get_explore_discovery_v5(p_user_id,p_limit,p_exclude); $$;

create or replace function public.get_trending_discovery_v3(p_limit integer default 20)
returns table(content_id uuid,creator_id uuid,title text,description text,source_url text,published_at timestamptz,score double precision)
language sql
stable security definer
set search_path to 'public'
as $$
with recent as materialized (
  select c.id as content_id,c.creator_id,c.title,c.description,c.source_url,c.published_at,c.text_content,
         least(1,greatest(0,coalesce(cf.normalized_quality,c.quality_score,0.5)))::double precision as quality,
         least(1,greatest(0,coalesce(cf.substance_score,public.discovery_content_substance_score(c.id),0.5)))::double precision as substance,
         least(1,greatest(0,public.discovery_freshness_factor(c.published_at)))::double precision as freshness,
         least(1,greatest(0,coalesce(cf.engagement_score,0)))::double precision as engagement
  from public.contents c
  join public.creators cr on cr.id=c.creator_id
  left join public.discovery_content_features cf on cf.content_id=c.id
  where coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and cr.is_active=true
    and coalesce(cf.normalized_quality,c.quality_score,0.5)>=0.35
    and c.published_at>=now()-interval '30 days'
  order by c.published_at desc nulls last
  limit 2500
),
scored as (
  select r.*,
         least(1,greatest(0,0.36*r.quality+0.18*r.substance+0.28*r.freshness+0.18*r.engagement))::double precision as raw_score,
         public.discovery_story_key_v1(r.content_id,r.title,r.description,r.text_content) as story_key
  from recent r
),
story_dedup as (
  select s.*,row_number() over(partition by story_key order by raw_score desc,published_at desc nulls last,content_id) as story_rank
  from scored s
),
creator_diverse as (
  select s.*,row_number() over(partition by creator_id order by raw_score desc,published_at desc nulls last,content_id) as creator_rank
  from story_dedup s where story_rank=1
)
select content_id,creator_id,title,description,source_url,published_at,
       greatest(0,raw_score-0.055*greatest(creator_rank-1,0))::double precision as score
from creator_diverse
where creator_rank<=2
order by score desc,published_at desc nulls last,content_id
limit greatest(least(coalesce(p_limit,20),100),1);
$$;

create or replace function public.get_trending_discovery_v2(p_limit integer default 20)
returns table(content_id uuid,creator_id uuid,title text,description text,source_url text,published_at timestamptz,score double precision)
language sql stable security definer set search_path to 'public'
as $$ select * from public.get_trending_discovery_v3(p_limit); $$;

revoke all on function public.get_explore_discovery_v5(uuid,integer,uuid[]) from public,anon,authenticated;
grant execute on function public.get_explore_discovery_v5(uuid,integer,uuid[]) to service_role;
revoke all on function public.get_trending_discovery_v3(integer) from public,anon,authenticated;
grant execute on function public.get_trending_discovery_v3(integer) to service_role;
