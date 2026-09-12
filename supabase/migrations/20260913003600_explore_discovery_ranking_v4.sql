create or replace function public.get_explore_discovery_v4(
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
set search_path = public
as $$
with params as (
  select
    greatest(least(p_limit,101),1) as lim,
    public.discovery_exploration_budget(p_user_id) as eb
),
base as (
  select
    dc.content_id,
    dc.creator_id,
    c.title,
    c.description,
    c.source_url,
    c.published_at,
    coalesce(cf.normalized_quality,coalesce(c.quality_score,0.5)) as quality,
    coalesce(cf.substance_score,public.discovery_content_substance_score(c.id),0.5) as substance,
    public.discovery_freshness_factor(c.published_at) as freshness,
    coalesce(cf.engagement_score,0) as engagement,
    least(1,greatest(0,coalesce(dc.topic_score,0))) as topic_score,
    least(1,greatest(0,coalesce(dc.exploration_score,0))) as exploration_score,
    least(1,greatest(0,public.semantic_content_score(p_user_id,c.id))) as interest_affinity,
    case when exists(
      select 1 from public.impressions i
      where i.user_id=p_user_id and i.content_id=c.id
        and i.created_at>now()-interval '30 days'
    ) then 0.0 else 1.0 end as unseen_bonus,
    case when exists(
      select 1
      from public.impressions i
      join public.contents ci on ci.id=i.content_id
      where i.user_id=p_user_id and ci.creator_id=c.creator_id
        and i.created_at>now()-interval '14 days'
    ) then 0.0 else 1.0 end as new_creator_bonus,
    least(
      1.0,
      (
        select count(*)::double precision / 5.0
        from public.impressions i
        join public.contents ci on ci.id=i.content_id
        where i.user_id=p_user_id
          and ci.creator_id=c.creator_id
          and i.created_at>now()-interval '7 days'
      )
    ) as creator_fatigue,
    ((hashtextextended(c.id::text || ':' || p_user_id::text || ':' || current_date::text,0) & 2147483647)::double precision / 2147483647.0) as daily_rotation
  from public.discovery_candidates dc
  join public.contents c on c.id=dc.content_id
  join public.creators cr on cr.id=dc.creator_id
  left join public.discovery_content_features cf on cf.content_id=c.id
  where coalesce(c.moderation_status,'PENDING')<>'REJECTED'
    and c.rights_status in ('AUTHORIZED','REFERENCE_ONLY')
    and cr.is_active=true
    and coalesce(cf.normalized_quality,coalesce(c.quality_score,0.5))>=0.35
    and not (c.id = any(coalesce(p_exclude,'{}'::uuid[])))
    and not exists(select 1 from public.saves s where s.user_id=p_user_id and s.content_id=c.id)
    and not exists(
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=c.id or (f.creator_id=c.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
),
scored as (
  select
    b.*,
    least(1,greatest(0,
      0.19*b.quality +
      0.14*b.substance +
      0.15*b.freshness +
      0.08*b.engagement +
      0.08*b.topic_score +
      (0.11+0.10*p.eb)*b.exploration_score +
      (0.12-0.08*p.eb)*b.interest_affinity +
      0.10*b.unseen_bonus +
      0.05*b.new_creator_bonus +
      0.02*b.daily_rotation -
      0.06*b.creator_fatigue
    )) as raw_score
  from base b cross join params p
),
with_topic as (
  select s.*,coalesce(t.slug,t.name,'unknown') as topic_key
  from scored s
  left join lateral (
    select tp.name,tp.slug
    from public.content_topics ct
    join public.topics tp on tp.id=ct.topic_id
    where ct.content_id=s.content_id
    order by ct.relevance desc nulls last,tp.name
    limit 1
  ) t on true
),
diverse as (
  select
    w.*,
    row_number() over(partition by creator_id order by raw_score desc,published_at desc nulls last,content_id) as creator_rank,
    row_number() over(partition by topic_key order by raw_score desc,published_at desc nulls last,content_id) as topic_rank
  from with_topic w
),
ranked as (
  select
    d.*,
    greatest(
      0,
      d.raw_score
      - 0.07*greatest(d.creator_rank-1,0)
      - 0.03*greatest(d.topic_rank-1,0)
    ) as final_score
  from diverse d
)
select content_id,creator_id,title,description,source_url,published_at,final_score
from ranked
order by final_score desc,published_at desc nulls last,content_id
limit (select lim from params);
$$;

create or replace function public.get_explore_discovery_v3(
  p_user_id uuid,
  p_limit integer default 20
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
set search_path = public
as $$
  select * from public.get_explore_discovery_v4(p_user_id,p_limit,'{}'::uuid[]);
$$;

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
set search_path = public
as $$
  select * from public.get_explore_discovery_v4(p_user_id,p_limit,p_exclude);
$$;
