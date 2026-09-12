create or replace function public.discovery_search_fold_v1(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(lower(coalesce(p_value, '')), chr(8204), ' '),
                'ـ', ''
              ),
              'ي', 'ی'
            ),
            'ى', 'ی'
          ),
          'ك', 'ک'
        ),
        'ة', 'ه'
      ),
      '[[:space:]]+', ' ', 'g'
    )
  );
$$;

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
set search_path = public
as $$
with q as (
  select
    public.discovery_search_fold_v1(p_query) as s,
    regexp_replace(public.discovery_search_fold_v1(p_query), '^@+', '') as bare,
    regexp_replace(public.discovery_search_fold_v1(p_query), '[^0-9-]', '', 'g') as digits
),
source_rows as (
  select
    'channel'::text as result_type,
    cr.id as result_id,
    null::uuid as content_id,
    cr.id as creator_id,
    coalesce(ts.title, cr.name, ts.username, cr.username, 'Telegram Channel') as title,
    coalesce(cr.bio, '') as description,
    coalesce(
      case when ts.username is not null then 'https://t.me/' || ts.username end,
      case when cr.username is not null then 'https://t.me/' || cr.username end,
      cr.source_url
    ) as source_url,
    null::timestamptz as published_at,
    (
      case
        when public.discovery_search_fold_v1(ts.username) = q.bare then 1.45
        when public.discovery_search_fold_v1(cr.username) = q.bare then 1.42
        when q.digits <> '' and ts.telegram_peer_id::text = q.digits then 1.40
        when public.discovery_search_fold_v1(ts.title) = q.s then 1.34
        when public.discovery_search_fold_v1(cr.name) = q.s then 1.31
        when public.discovery_search_fold_v1(ts.username) like q.bare || '%' then 1.18
        when public.discovery_search_fold_v1(cr.username) like q.bare || '%' then 1.16
        when public.discovery_search_fold_v1(ts.title) like q.s || '%' then 1.08
        when public.discovery_search_fold_v1(cr.name) like q.s || '%' then 1.06
        when public.discovery_search_fold_v1(ts.username) like '%' || q.bare || '%' then 0.94
        when public.discovery_search_fold_v1(cr.username) like '%' || q.bare || '%' then 0.92
        when public.discovery_search_fold_v1(ts.title) like '%' || q.s || '%' then 0.88
        when public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%' then 0.86
        else 0.62
      end
      + 0.28 * greatest(
          similarity(
            public.discovery_search_fold_v1(
              coalesce(ts.title,'') || ' ' || coalesce(ts.username,'') || ' ' ||
              coalesce(cr.name,'') || ' ' || coalesce(cr.username,'')
            ), q.s
          ), 0
        )
    )::double precision as score,
    coalesce(ts.username, cr.username) as channel_username,
    coalesce(ts.title, cr.name) as channel_title,
    ts.telegram_peer_id::bigint as channel_peer_id,
    coalesce(ts.peer_kind, 'channel')::text as channel_type
  from public.telegram_sources ts
  left join public.creators cr
    on public.discovery_search_fold_v1(cr.username) = public.discovery_search_fold_v1(ts.username)
  cross join q
  where q.s <> ''
    and coalesce(ts.enabled, true) = true
    and (
      public.discovery_search_fold_v1(ts.username) like '%' || q.bare || '%'
      or public.discovery_search_fold_v1(cr.username) like '%' || q.bare || '%'
      or public.discovery_search_fold_v1(ts.title) like '%' || q.s || '%'
      or public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%'
      or (q.digits <> '' and ts.telegram_peer_id::text = q.digits)
      or similarity(
          public.discovery_search_fold_v1(
            coalesce(ts.title,'') || ' ' || coalesce(ts.username,'') || ' ' ||
            coalesce(cr.name,'') || ' ' || coalesce(cr.username,'')
          ), q.s
        ) >= 0.22
    )
),
creator_only as (
  select
    'channel'::text as result_type,
    cr.id as result_id,
    null::uuid as content_id,
    cr.id as creator_id,
    coalesce(cr.name, cr.username, 'Telegram Channel') as title,
    coalesce(cr.bio, '') as description,
    coalesce(cr.source_url, case when cr.username is not null then 'https://t.me/' || cr.username end) as source_url,
    null::timestamptz as published_at,
    (
      case
        when public.discovery_search_fold_v1(cr.username) = q.bare then 1.38
        when public.discovery_search_fold_v1(cr.name) = q.s then 1.27
        when public.discovery_search_fold_v1(cr.username) like q.bare || '%' then 1.12
        when public.discovery_search_fold_v1(cr.name) like q.s || '%' then 1.02
        when public.discovery_search_fold_v1(cr.username) like '%' || q.bare || '%' then 0.90
        when public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%' then 0.84
        else 0.60
      end
      + 0.26 * greatest(
          similarity(
            public.discovery_search_fold_v1(coalesce(cr.name,'') || ' ' || coalesce(cr.username,'')),
            q.s
          ), 0
        )
    )::double precision as score,
    cr.username as channel_username,
    cr.name as channel_title,
    null::bigint as channel_peer_id,
    'channel'::text as channel_type
  from public.creators cr
  cross join q
  where q.s <> ''
    and coalesce(cr.is_active, true) = true
    and (
      public.discovery_search_fold_v1(cr.username) like '%' || q.bare || '%'
      or public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%'
      or similarity(
          public.discovery_search_fold_v1(coalesce(cr.name,'') || ' ' || coalesce(cr.username,'')),
          q.s
        ) >= 0.22
    )
    and not exists (
      select 1 from public.telegram_sources ts
      where public.discovery_search_fold_v1(ts.username) = public.discovery_search_fold_v1(cr.username)
    )
),
content_rows as (
  select
    'post'::text as result_type,
    c.id as result_id,
    c.id as content_id,
    c.creator_id,
    c.title,
    c.description,
    c.source_url,
    c.published_at,
    (
      case
        when public.discovery_search_fold_v1(c.title) = q.s then 1.42
        when public.discovery_search_fold_v1(c.title) like q.s || '%' then 1.20
        when public.discovery_search_fold_v1(c.title) like '%' || q.s || '%' then 1.06
        when exists (
          select 1
          from public.content_topics ct
          join public.topics t on t.id = ct.topic_id
          where ct.content_id = c.id
            and public.discovery_search_fold_v1(t.name) = q.s
        ) then 1.02
        when public.discovery_search_fold_v1(c.description) like '%' || q.s || '%' then 0.88
        when public.discovery_search_fold_v1(c.text_content) like '%' || q.s || '%' then 0.82
        when public.discovery_search_fold_v1(cr.username) = q.bare then 0.80
        when public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%' then 0.76
        else 0.58
      end
      + 0.24 * greatest(
          similarity(
            public.discovery_search_fold_v1(
              coalesce(c.title,'') || ' ' || coalesce(c.description,'') || ' ' || coalesce(c.text_content,'')
            ), q.s
          ), 0
        )
      + 0.16 * least(1, greatest(0, coalesce(c.quality_score, 0.5)))
      + 0.12 * least(1, greatest(0, coalesce(public.discovery_freshness_factor(c.published_at), 0)))
      + 0.10 * least(1, greatest(0, coalesce(public.semantic_content_score(p_user_id, c.id), 0)))
    )::double precision as score,
    cr.username as channel_username,
    cr.name as channel_title,
    ts.telegram_peer_id::bigint as channel_peer_id,
    coalesce(ts.peer_kind, 'channel')::text as channel_type
  from public.contents c
  join public.creators cr on cr.id = c.creator_id
  left join public.telegram_sources ts
    on public.discovery_search_fold_v1(ts.username) = public.discovery_search_fold_v1(cr.username)
  cross join q
  where q.s <> ''
    and coalesce(cr.is_active, true) = true
    and coalesce(c.rights_status,'REFERENCE_ONLY') in ('AUTHORIZED','REFERENCE_ONLY')
    and coalesce(c.moderation_status,'PENDING') <> 'REJECTED'
    and not exists (
      select 1
      from public.feedback f
      where f.user_id = p_user_id
        and f.feedback_type in ('HIDE_CREATOR','REPORT')
        and (f.content_id = c.id or f.creator_id = c.creator_id)
    )
    and (
      public.discovery_search_fold_v1(c.title) like '%' || q.s || '%'
      or public.discovery_search_fold_v1(c.description) like '%' || q.s || '%'
      or public.discovery_search_fold_v1(c.text_content) like '%' || q.s || '%'
      or public.discovery_search_fold_v1(cr.username) like '%' || q.bare || '%'
      or public.discovery_search_fold_v1(cr.name) like '%' || q.s || '%'
      or exists (
        select 1
        from public.content_topics ct
        join public.topics t on t.id = ct.topic_id
        where ct.content_id = c.id
          and public.discovery_search_fold_v1(t.name) like '%' || q.s || '%'
      )
      or (q.digits <> '' and c.source_id like '%' || q.digits || '%')
      or similarity(
          public.discovery_search_fold_v1(
            coalesce(c.title,'') || ' ' || coalesce(c.description,'') || ' ' || coalesce(c.text_content,'')
          ), q.s
        ) >= 0.10
    )
),
ranked as (
  select * from source_rows
  union all
  select * from creator_only
  union all
  select * from content_rows
),
deduped as (
  select r.*,
         row_number() over (
           partition by result_type,
             coalesce(content_id::text, lower(coalesce(channel_username,'')), result_id::text)
           order by score desc, published_at desc nulls last
         ) as duplicate_rank
  from ranked r
)
select
  result_type,result_id,content_id,creator_id,title,description,source_url,
  published_at,score,channel_username,channel_title,channel_peer_id,channel_type
from deduped
where duplicate_rank = 1
order by score desc, published_at desc nulls last,
         case when result_type = 'channel' then 0 else 1 end
limit greatest(least(coalesce(p_limit,20),100),1);
$$;
