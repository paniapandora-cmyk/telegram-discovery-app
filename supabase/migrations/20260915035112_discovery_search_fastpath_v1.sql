-- Bounded search for the enlarged corpus. Avoid semantic/user scoring across
-- every content row on each query.

create or replace function public.search_discovery_v2(
  p_user_id uuid,p_query text,p_limit integer default 20
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public','extensions'
as $function$
with q as (
  select lower(trim(regexp_replace(coalesce(p_query,''),'\s+',' ','g'))) s,
         greatest(1,least(coalesce(p_limit,20),30))::int lim
),
candidate_ids as materialized (
  select dc.content_id
  from public.discovery_candidates dc
  where dc.final_score is not null
  order by dc.final_score desc,dc.generated_at desc
  limit 24
),
recent_ids as materialized (
  select c.id content_id
  from public.contents c
  where c.published_at is not null
  order by c.published_at desc
  limit 16
),
seed as materialized (
  select content_id from candidate_ids
  union
  select content_id from recent_ids
),
matched as materialized (
  select c.id content_id,c.creator_id,c.title,c.description,c.source_url,c.published_at,
         case
           when lower(coalesce(cr.username,''))=q.s then 1.00
           when lower(coalesce(cr.name,''))=q.s then 0.98
           when lower(coalesce(c.title,''))=q.s then 0.96
           when lower(coalesce(cr.username,'')) like '%'||q.s||'%' then 0.92
           when lower(coalesce(cr.name,'')) like '%'||q.s||'%' then 0.90
           when lower(coalesce(c.title,'')) like '%'||q.s||'%' then 0.88
           when lower(coalesce(c.description,'')) like '%'||q.s||'%' then 0.78
           when lower(coalesce(c.text_content,'')) like '%'||q.s||'%' then 0.70
           else 0.0
         end::double precision lexical_score,
         greatest(0.0,similarity(lower(coalesce(c.title,'')||' '||coalesce(c.description,'')||' '||coalesce(c.text_content,'')),q.s))::double precision trigram_score,
         coalesce(c.quality_score,0.5)::double precision quality
  from seed s
  join public.contents c on c.id=s.content_id
  join public.creators cr on cr.id=c.creator_id
  cross join q
  where q.s<>''
    and cr.is_active=true
    and coalesce(c.moderation_status::text,'PENDING')<>'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and (
      lower(coalesce(cr.username,'')) like '%'||q.s||'%'
      or lower(coalesce(cr.name,'')) like '%'||q.s||'%'
      or lower(coalesce(c.title,'')) like '%'||q.s||'%'
      or lower(coalesce(c.description,'')) like '%'||q.s||'%'
      or lower(coalesce(c.text_content,'')) like '%'||q.s||'%'
      or similarity(lower(coalesce(c.title,'')||' '||coalesce(c.description,'')||' '||coalesce(c.text_content,'')),q.s)>=0.18
    )
    and not exists (
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and (f.content_id=c.id or (f.creator_id=c.creator_id and f.feedback_type='HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
)
select m.content_id,m.creator_id,m.title,m.description,m.source_url,m.published_at,
       least(1.0,greatest(0.0,m.lexical_score+0.08*m.trigram_score+0.04*m.quality))::double precision score
from matched m
order by score desc,m.published_at desc,m.content_id
limit (select lim from q);
$function$;

create or replace function public.search_discovery_hybrid_v1(
  p_user_id uuid,p_query text,p_query_embedding jsonb default null,p_limit integer default 20
)
returns table(content_id uuid, creator_id uuid, title text, description text, source_url text, published_at timestamptz, score double precision)
language sql stable security definer set search_path to 'public','extensions'
as $function$
  select * from public.search_discovery_v2(p_user_id,p_query,p_limit);
$function$;
