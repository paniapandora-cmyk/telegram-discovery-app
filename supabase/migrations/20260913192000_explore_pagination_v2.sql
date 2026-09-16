-- Fast, exclusion-aware Explore pagination for a larger Telegram corpus.
-- The previous v5 path repeatedly executed expensive per-candidate user queries
-- and could time out after the source library grew into tens of thousands of posts.

create or replace function public.get_explore_discovery_page_v2(
  p_user_id uuid,
  p_limit integer default 25,
  p_exclude uuid[] default '{}'::uuid[]
)
returns table(
  content_id uuid,
  creator_id uuid,
  title text,
  description text,
  source_url text,
  published_at timestamptz,
  score double precision
)
language sql
stable
security definer
set search_path to 'public'
as $function$
with params as (
  select
    greatest(1, least(coalesce(p_limit,25),100))::int as lim,
    least(
      2200,
      greatest(900, greatest(1, least(coalesce(p_limit,25),100)) * 36)
    )::int as pool_limit
),
pre as materialized (
  select
    dc.content_id,
    dc.creator_id,
    c.title,
    c.description,
    c.text_content,
    c.source_url,
    c.published_at,
    least(1.0, greatest(0.0, coalesce(dc.final_score, dc.base_score, 0.5)))::double precision as candidate_score,
    least(1.0, greatest(0.0, coalesce(dc.exploration_score, 0.25)))::double precision as exploration_score,
    least(1.0, greatest(0.0, coalesce(dc.topic_score, 0)))::double precision as topic_score,
    least(1.0, greatest(0.0, coalesce(cf.normalized_quality, c.quality_score, dc.quality_score, 0.5)))::double precision as quality,
    least(1.0, greatest(0.0, coalesce(cf.freshness_score, dc.freshness_score, public.discovery_freshness_factor(c.published_at), 0)))::double precision as freshness
  from public.discovery_candidates dc
  join public.contents c on c.id = dc.content_id
  join public.creators cr on cr.id = dc.creator_id
  left join public.discovery_content_features cf on cf.content_id = dc.content_id
  cross join params p
  where coalesce(cr.is_active,true) = true
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and coalesce(cf.normalized_quality, c.quality_score, dc.quality_score, 0.5) >= 0.28
    and not (c.id = any(coalesce(p_exclude,'{}'::uuid[])))
    and not exists (
      select 1 from public.saves s
      where s.user_id = p_user_id and s.content_id = c.id
    )
    and not exists (
      select 1 from public.feedback f
      where f.user_id = p_user_id
        and (f.content_id = c.id or (f.creator_id = c.creator_id and f.feedback_type = 'HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
  order by dc.final_score desc nulls last, dc.generated_at desc nulls last, c.published_at desc nulls last
  limit (select pool_limit from params)
),
seen as materialized (
  select distinct i.content_id
  from public.impressions i
  join pre p on p.content_id = i.content_id
  where i.user_id = p_user_id
    and i.created_at >= now() - interval '30 days'
),
creator_activity as materialized (
  select c.creator_id, count(*)::int as recent_views
  from public.impressions i
  join public.contents c on c.id = i.content_id
  join (select distinct creator_id from pre) pc on pc.creator_id = c.creator_id
  where i.user_id = p_user_id
    and i.created_at >= now() - interval '7 days'
  group by c.creator_id
),
interest as materialized (
  select
    ct.content_id,
    least(1.0, greatest(0.0, sum(coalesce(ui.weight,1.0) * coalesce(ct.relevance,0.5))))::double precision as affinity
  from public.user_interests ui
  join public.content_topics ct on ct.topic_id = ui.topic_id
  join pre p on p.content_id = ct.content_id
  where ui.user_id = p_user_id
  group by ct.content_id
),
scored as (
  select
    p.*,
    coalesce(ints.affinity,0)::double precision as interest_affinity,
    case when s.content_id is null then 1.0 else 0.0 end::double precision as unseen_bonus,
    case when ca.creator_id is null then 1.0 else 0.0 end::double precision as new_creator_bonus,
    least(1.0, coalesce(ca.recent_views,0)::double precision / 8.0)::double precision as creator_fatigue,
    ((hashtextextended(p.content_id::text || ':' || p_user_id::text || ':' || current_date::text,0) & 2147483647)::double precision / 2147483647.0) as daily_rotation
  from pre p
  left join seen s on s.content_id = p.content_id
  left join creator_activity ca on ca.creator_id = p.creator_id
  left join interest ints on ints.content_id = p.content_id
),
weighted as (
  select
    s.*,
    least(1.0, greatest(0.0,
      0.31*s.candidate_score +
      0.17*s.quality +
      0.13*s.freshness +
      0.11*s.exploration_score +
      0.08*s.topic_score +
      0.09*s.interest_affinity +
      0.06*s.unseen_bonus +
      0.025*s.new_creator_bonus +
      0.025*s.daily_rotation -
      0.06*s.creator_fatigue
    ))::double precision as raw_score,
    public.discovery_story_key_v1(s.content_id,s.title,s.description,s.text_content) as story_key
  from scored s
),
story_dedup as (
  select w.*,
    row_number() over(
      partition by w.story_key
      order by w.raw_score desc, w.published_at desc nulls last, w.content_id
    ) as story_rank
  from weighted w
),
creator_diverse as (
  select d.*,
    row_number() over(
      partition by d.creator_id
      order by d.raw_score desc, d.published_at desc nulls last, d.content_id
    ) as creator_rank
  from story_dedup d
  where d.story_rank = 1
),
finalized as (
  select
    d.*,
    greatest(0.0, d.raw_score - 0.035 * greatest(d.creator_rank - 1,0))::double precision as final_score
  from creator_diverse d
  where d.creator_rank <= 4
)
select
  f.content_id,
  f.creator_id,
  f.title,
  f.description,
  f.source_url,
  f.published_at,
  f.final_score as score
from finalized f
order by f.final_score desc, f.published_at desc nulls last, f.content_id
limit (select lim from params);
$function$;

-- Preserve the existing API contract. The Edge Function continues to call v1,
-- while the wrapper now routes to the optimized implementation.
create or replace function public.get_explore_discovery_page_v1(
  p_user_id uuid,
  p_limit integer default 25,
  p_exclude uuid[] default '{}'::uuid[]
)
returns table(
  content_id uuid,
  creator_id uuid,
  title text,
  description text,
  source_url text,
  published_at timestamptz,
  score double precision
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select * from public.get_explore_discovery_page_v2(p_user_id,p_limit,p_exclude);
$function$;
