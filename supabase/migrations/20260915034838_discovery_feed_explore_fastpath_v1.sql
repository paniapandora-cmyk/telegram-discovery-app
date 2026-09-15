-- Emergency serving fast path for the enlarged Telegram corpus.
-- Preserve public RPC contracts while ranking a bounded indexed candidate pool.

create or replace function public.get_explore_discovery_page_v2(
  p_user_id uuid,
  p_limit integer default 25,
  p_exclude uuid[] default '{}'::uuid[]
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public'
as $function$
with params as (
  select greatest(1,least(coalesce(p_limit,25),24))::int as lim
),
seed as materialized (
  select dc.content_id,dc.creator_id,dc.final_score::double precision candidate_score,
         dc.quality_score::double precision candidate_quality,
         dc.freshness_score::double precision candidate_freshness,
         dc.exploration_score::double precision exploration_score
  from public.discovery_candidates dc
  where dc.final_score is not null
    and not (dc.content_id=any(coalesce(p_exclude,'{}'::uuid[])))
  order by dc.final_score desc,dc.generated_at desc
  limit 40
),
interest as materialized (
  select ct.content_id,
         least(1.0,greatest(0.0,sum(coalesce(ui.weight,1.0)*coalesce(ct.relevance,0.5))))::double precision affinity
  from public.user_interests ui
  join public.content_topics ct on ct.topic_id=ui.topic_id
  join seed s on s.content_id=ct.content_id
  where ui.user_id=p_user_id
  group by ct.content_id
),
scored as materialized (
  select s.content_id,s.creator_id,c.title,c.description,c.source_url,c.published_at,
         least(1.0,greatest(0.0,
           0.74*s.candidate_score+
           0.08*coalesce(s.candidate_quality,c.quality_score,0.5)+
           0.06*coalesce(s.candidate_freshness,0.5)+
           0.07*coalesce(i.affinity,0)+
           0.05*coalesce(s.exploration_score,0.25)
         ))::double precision raw_score,
         row_number() over(partition by s.creator_id order by s.candidate_score desc,c.published_at desc,s.content_id)::int creator_rank
  from seed s
  join public.contents c on c.id=s.content_id
  join public.creators cr on cr.id=s.creator_id
  left join interest i on i.content_id=s.content_id
  where cr.is_active=true
    and coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and c.published_at is not null
    and c.published_at>=now()-interval '14 days'
    and not exists (
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=s.content_id or (f.creator_id=s.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
)
select s.content_id,s.creator_id,s.title,s.description,s.source_url,s.published_at,
       greatest(0.0,s.raw_score-0.035*greatest(s.creator_rank-1,0))::double precision score
from scored s
where s.creator_rank<=4
order by score desc,s.published_at desc,s.content_id
limit (select lim from params);
$function$;

create or replace function public.get_explore_discovery_page_v1(
  p_user_id uuid,p_limit integer default 25,p_exclude uuid[] default '{}'::uuid[]
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public'
as $function$
  select * from public.get_explore_discovery_page_v2(p_user_id,p_limit,p_exclude);
$function$;

create or replace function public.get_explore_discovery_v2(p_user_id uuid,p_limit integer default 20)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public'
as $function$
  select * from public.get_explore_discovery_page_v2(p_user_id,p_limit,'{}'::uuid[]);
$function$;

create or replace function public.get_trending_discovery_v3(p_limit integer default 20)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public'
as $function$
with params as (select greatest(1,least(coalesce(p_limit,20),24))::int lim),
seed as materialized (
  select dc.content_id,dc.creator_id,dc.final_score::double precision candidate_score
  from public.discovery_candidates dc
  where dc.final_score is not null
  order by dc.final_score desc,dc.generated_at desc
  limit 40
),
ranked as materialized (
  select s.content_id,s.creator_id,c.title,c.description,c.source_url,c.published_at,s.candidate_score raw_score,
         row_number() over(partition by s.creator_id order by s.candidate_score desc,c.published_at desc,s.content_id)::int creator_rank
  from seed s
  join public.contents c on c.id=s.content_id
  join public.creators cr on cr.id=s.creator_id
  where cr.is_active=true
    and coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and c.published_at is not null
    and c.published_at>=now()-interval '14 days'
)
select r.content_id,r.creator_id,r.title,r.description,r.source_url,r.published_at,
       greatest(0.0,r.raw_score-0.04*greatest(r.creator_rank-1,0))::double precision score
from ranked r
where r.creator_rank<=4
order by score desc,r.published_at desc,r.content_id
limit (select lim from params);
$function$;

create or replace function public.get_personalized_feed_v9(
  p_user_id uuid,p_session_id uuid default null,p_limit integer default 20,p_offset integer default 0
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, thumbnail_url text, published_at timestamptz, score double precision, reason text, source_bucket text, feed_position integer)
language sql stable set search_path to 'public'
as $function$
with params as (
  select greatest(1,least(coalesce(p_limit,20),24))::int lim,
         greatest(0,least(coalesce(p_offset,0),18))::int off
),
seed as materialized (
  select dc.content_id,dc.creator_id,dc.final_score::double precision candidate_score,
         dc.quality_score::double precision candidate_quality,
         dc.freshness_score::double precision candidate_freshness
  from public.discovery_candidates dc
  where dc.final_score is not null
  order by dc.final_score desc,dc.generated_at desc
  limit 40
),
interest as materialized (
  select ct.content_id,
         least(1.0,greatest(0.0,sum(coalesce(ui.weight,1.0)*coalesce(ct.relevance,0.5))))::double precision affinity
  from public.user_interests ui
  join public.content_topics ct on ct.topic_id=ui.topic_id
  join seed s on s.content_id=ct.content_id
  where ui.user_id=p_user_id
  group by ct.content_id
),
scored as materialized (
  select s.content_id,s.creator_id,c.title,c.description,c.source_url,c.thumbnail_url,c.published_at,
         least(1.0,greatest(0.0,
           0.80*s.candidate_score+
           0.07*coalesce(s.candidate_quality,c.quality_score,0.5)+
           0.04*coalesce(s.candidate_freshness,0.5)+
           0.06*coalesce(i.affinity,0)+
           case when f.creator_id is not null then 0.08 else 0 end
         ))::double precision raw_score,
         case when f.creator_id is not null then 'followed'::text else 'ranked_fast'::text end reason,
         case when f.creator_id is not null then 'followed'::text else 'personalized'::text end source_bucket,
         row_number() over(partition by s.creator_id order by
           (s.candidate_score+case when f.creator_id is not null then 0.08 else 0 end+0.06*coalesce(i.affinity,0)) desc,
           c.published_at desc,s.content_id)::int creator_rank
  from seed s
  join public.contents c on c.id=s.content_id
  join public.creators cr on cr.id=s.creator_id
  left join public.follows f on f.user_id=p_user_id and f.creator_id=s.creator_id
  left join interest i on i.content_id=s.content_id
  where cr.is_active=true
    and coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and c.published_at is not null
    and c.published_at>=now()-interval '14 days'
    and not exists (
      select 1 from public.feedback fb
      where fb.user_id=p_user_id
        and (fb.content_id=s.content_id or (fb.creator_id=s.creator_id and fb.feedback_type='HIDE_CREATOR'))
        and fb.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
),
diverse as materialized (
  select s.*,greatest(0.0,s.raw_score-0.035*greatest(s.creator_rank-1,0))::double precision final_score
  from scored s where s.creator_rank<=4
),
numbered as (
  select d.*,row_number() over(order by d.final_score desc,d.published_at desc,d.content_id)::int pos
  from diverse d
)
select n.content_id,n.creator_id,n.title,n.description,n.source_url,n.thumbnail_url,n.published_at,
       n.final_score score,n.reason,n.source_bucket,(n.pos-(select off from params))::int feed_position
from numbered n cross join params p
where n.pos>p.off and n.pos<=p.off+p.lim
order by n.pos;
$function$;
