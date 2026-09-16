-- Allow Explore POST to request limit+1 so has_more remains accurate.
create or replace function public.get_explore_discovery_page_v2(
  p_user_id uuid,
  p_limit integer default 25,
  p_exclude uuid[] default '{}'::uuid[]
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public'
as $function$
with params as (
  select greatest(1,least(coalesce(p_limit,25),25))::int as lim
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
