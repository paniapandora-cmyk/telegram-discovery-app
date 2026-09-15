-- Fast unified search for the enlarged Telegram corpus.
-- Content lookup is isolated in a helper with seq scans disabled so common
-- Persian terms use the existing trigram GIN index instead of scanning all rows.

create or replace function public.search_content_ids_trgm_v1(
  p_query text,
  p_limit integer default 320
)
returns table(content_id uuid)
language sql
stable
security definer
set search_path to 'public','extensions'
set enable_seqscan to off
as $function$
  select c.id
  from public.contents c
  where length(trim(coalesce(p_query,''))) >= 2
    and coalesce(c.rights_status::text,'REFERENCE_ONLY') in ('AUTHORIZED','REFERENCE_ONLY')
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and lower(coalesce(c.title,'')||' '||coalesce(c.description,'')||' '||coalesce(c.text_content,''))
        like '%'||lower(trim(p_query))||'%'
  limit greatest(1,least(coalesce(p_limit,320),600));
$function$;

revoke all on function public.search_content_ids_trgm_v1(text,integer) from public,anon,authenticated;
grant execute on function public.search_content_ids_trgm_v1(text,integer) to service_role;

create or replace function public.search_discovery_unified(
  p_user_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table(
  result_type text,
  result_id uuid,
  content_id uuid,
  creator_id uuid,
  title text,
  description text,
  source_url text,
  published_at timestamptz,
  score double precision,
  channel_username text,
  channel_title text,
  channel_peer_id bigint,
  channel_type text
)
language sql
stable
security definer
set search_path to 'public','extensions'
as $function$
with q as materialized (
  select
    public.discovery_search_fold_v1(coalesce(p_query,'')) as folded,
    lower(trim(regexp_replace(coalesce(p_query,''),'\s+',' ','g'))) as raw,
    regexp_replace(public.discovery_search_fold_v1(coalesce(p_query,'')),'^@+','') as bare,
    greatest(1,least(coalesce(p_limit,20),50))::int as lim
),
channel_rows as materialized (
  select
    'channel'::text as result_type,
    coalesce(cr.id,ts.id) as result_id,
    null::uuid as content_id,
    cr.id as creator_id,
    coalesce(ts.title,cr.name,ts.username,cr.username,'Telegram Channel') as title,
    coalesce(cr.bio,'') as description,
    coalesce(
      case when ts.username is not null then 'https://t.me/'||ts.username end,
      case when cr.username is not null then 'https://t.me/'||cr.username end,
      cr.source_url
    ) as source_url,
    null::timestamptz as published_at,
    (case
      when public.discovery_search_fold_v1(ts.username)=q.bare then 1.45
      when public.discovery_search_fold_v1(cr.username)=q.bare then 1.42
      when public.discovery_search_fold_v1(ts.title)=q.folded then 1.34
      when public.discovery_search_fold_v1(cr.name)=q.folded then 1.31
      when public.discovery_search_fold_v1(ts.username) like q.bare||'%' then 1.18
      when public.discovery_search_fold_v1(cr.username) like q.bare||'%' then 1.16
      when public.discovery_search_fold_v1(ts.title) like q.folded||'%' then 1.08
      when public.discovery_search_fold_v1(cr.name) like q.folded||'%' then 1.06
      else 0.88 end)::double precision as score,
    coalesce(ts.username,cr.username) as channel_username,
    coalesce(ts.title,cr.name) as channel_title,
    ts.telegram_peer_id::bigint as channel_peer_id,
    coalesce(ts.peer_kind,'channel')::text as channel_type
  from public.telegram_sources ts
  left join public.creators cr on lower(coalesce(cr.username,''))=lower(coalesce(ts.username,''))
  cross join q
  where length(q.folded)>=2
    and coalesce(ts.enabled,true)=true
    and (
      public.discovery_search_fold_v1(ts.username) like '%'||q.bare||'%'
      or public.discovery_search_fold_v1(cr.username) like '%'||q.bare||'%'
      or public.discovery_search_fold_v1(ts.title) like '%'||q.folded||'%'
      or public.discovery_search_fold_v1(cr.name) like '%'||q.folded||'%'
    )
),
creator_rows as materialized (
  select
    'channel'::text as result_type,
    cr.id as result_id,
    null::uuid as content_id,
    cr.id as creator_id,
    coalesce(cr.name,cr.username,'Telegram Channel') as title,
    coalesce(cr.bio,'') as description,
    coalesce(cr.source_url,case when cr.username is not null then 'https://t.me/'||cr.username end) as source_url,
    null::timestamptz as published_at,
    (case
      when public.discovery_search_fold_v1(cr.username)=q.bare then 1.38
      when public.discovery_search_fold_v1(cr.name)=q.folded then 1.27
      when public.discovery_search_fold_v1(cr.username) like q.bare||'%' then 1.12
      when public.discovery_search_fold_v1(cr.name) like q.folded||'%' then 1.02
      else 0.84 end)::double precision as score,
    cr.username as channel_username,
    cr.name as channel_title,
    null::bigint as channel_peer_id,
    'channel'::text as channel_type
  from public.creators cr cross join q
  where length(q.folded)>=2
    and coalesce(cr.is_active,true)=true
    and (
      public.discovery_search_fold_v1(cr.username) like '%'||q.bare||'%'
      or public.discovery_search_fold_v1(cr.name) like '%'||q.folded||'%'
    )
    and not exists (
      select 1 from public.telegram_sources ts
      where lower(coalesce(ts.username,''))=lower(coalesce(cr.username,''))
    )
),
seed as materialized (
  select content_id from public.search_content_ids_trgm_v1((select raw from q),320)
  union
  select content_id from public.search_content_ids_trgm_v1((select folded from q),180)
),
content_rows as materialized (
  select
    'post'::text as result_type,
    c.id as result_id,
    c.id as content_id,
    c.creator_id,
    c.title,
    c.description,
    c.source_url,
    c.published_at,
    least(1.40,greatest(0.0,
      (case
        when public.discovery_search_fold_v1(c.title)=q.folded then 1.16
        when public.discovery_search_fold_v1(c.title) like q.folded||'%' then 1.03
        when lower(coalesce(c.title,'')) like '%'||q.raw||'%' then 0.92
        when lower(coalesce(c.description,'')) like '%'||q.raw||'%' then 0.80
        when lower(coalesce(c.text_content,'')) like '%'||q.raw||'%' then 0.74
        else 0.62 end)
      + 0.10*least(1.0,greatest(0.0,coalesce(c.quality_score,0.5)))
      + 0.08*least(1.0,greatest(0.0,coalesce(public.discovery_freshness_factor(c.published_at),0.0)))
    ))::double precision as score,
    cr.username as channel_username,
    cr.name as channel_title,
    ts.telegram_peer_id::bigint as channel_peer_id,
    coalesce(ts.peer_kind,'channel')::text as channel_type
  from seed s
  join public.contents c on c.id=s.content_id
  join public.creators cr on cr.id=c.creator_id
  left join public.telegram_sources ts on lower(coalesce(ts.username,''))=lower(coalesce(cr.username,''))
  cross join q
  where coalesce(cr.is_active,true)=true
    and not exists (
      select 1 from public.feedback f
      where f.user_id=p_user_id
        and f.feedback_type in ('HIDE_CREATOR','REPORT')
        and (f.content_id=c.id or f.creator_id=c.creator_id)
    )
),
ranked as (
  select * from channel_rows
  union all select * from creator_rows
  union all select * from content_rows
),
deduped as (
  select r.*,
    row_number() over(
      partition by result_type,coalesce(content_id::text,lower(coalesce(channel_username,'')),result_id::text)
      order by score desc,published_at desc nulls last
    ) as duplicate_rank
  from ranked r
)
select result_type,result_id,content_id,creator_id,title,description,source_url,published_at,
       score,channel_username,channel_title,channel_peer_id,channel_type
from deduped
where duplicate_rank=1
order by score desc,published_at desc nulls last,case when result_type='channel' then 0 else 1 end
limit (select lim from q);
$function$;

comment on function public.search_discovery_unified(uuid,text,integer)
is 'Fast search v6: helper forces trigram index only for bounded content-id lookup; channel tables keep normal planner; no semantic full-corpus scan.';
