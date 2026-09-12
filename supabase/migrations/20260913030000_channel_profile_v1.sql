create or replace function public.get_channel_profile_v1(
  p_user_id uuid,
  p_creator_id uuid,
  p_limit integer default 18
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with creator_row as (
  select c.id, c.name, c.username, c.bio, c.avatar_url, c.source_url, c.verified
  from public.creators c
  where c.id = p_creator_id and c.is_active = true
),
visible_contents as (
  select c.*
  from public.contents c
  join creator_row cr on cr.id = c.creator_id
  where coalesce(c.moderation_status::text, 'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
),
profile_stats as (
  select
    (select count(*)::int from visible_contents) as posts_count,
    (select count(*)::int from public.follows f where f.creator_id = p_creator_id) as followers_count,
    (select count(*)::int from public.saves s join visible_contents vc on vc.id = s.content_id) as saves_count,
    (select count(*)::int
       from public.events e
       join visible_contents vc on vc.id = e.content_id
      where e.created_at >= now() - interval '30 days'
        and upper(e.event_type) in ('OPEN','VIEW','LONG_VIEW')) as views_30d,
    (select count(distinct e.user_id)::int
       from public.events e
       join visible_contents vc on vc.id = e.content_id
      where e.created_at >= now() - interval '30 days'
        and upper(e.event_type) in ('OPEN','VIEW','LONG_VIEW')) as unique_viewers_30d,
    (select count(*)::int from visible_contents where published_at >= now() - interval '30 days') as recent_posts,
    (select coalesce(avg(coalesce(cf.normalized_quality, vc.quality_score, 0.5)),0.5)::double precision
       from visible_contents vc
       left join public.discovery_content_features cf on cf.content_id = vc.id) as avg_quality,
    (select max(published_at) from visible_contents) as last_post_at
),
topic_weights as (
  select t.id, t.name, t.slug, sum(coalesce(ct.relevance,0.5))::double precision as weight
  from visible_contents vc
  join public.content_topics ct on ct.content_id = vc.id
  join public.topics t on t.id = ct.topic_id
  group by t.id, t.name, t.slug
),
topics_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'weight', weight
  ) order by weight desc, name), '[]'::jsonb) as value
  from (select * from topic_weights order by weight desc, name limit 8) q
),
posts_json as (
  select coalesce(jsonb_agg(post_row order by published_at desc nulls last, content_id), '[]'::jsonb) as value
  from (
    select
      vc.id as content_id,
      vc.creator_id,
      vc.title,
      vc.description,
      vc.text_content,
      vc.source_url,
      vc.content_type::text as content_type,
      vc.media_url,
      vc.thumbnail_url,
      vc.published_at,
      cr.username as channel_username,
      cr.name as channel_name,
      cr.avatar_url as channel_avatar_url,
      cr.source_url as channel_url,
      exists(select 1 from public.saves s where s.user_id = p_user_id and s.content_id = vc.id) as is_saved,
      coalesce(cf.normalized_quality, vc.quality_score, 0.5)::double precision as quality,
      coalesce(pt.name, pt.slug, 'تلگرام') as category,
      jsonb_build_object(
        'content_id', vc.id,
        'creator_id', vc.creator_id,
        'title', vc.title,
        'description', vc.description,
        'text_content', vc.text_content,
        'source_url', vc.source_url,
        'content_type', vc.content_type::text,
        'media_url', vc.media_url,
        'thumbnail_url', vc.thumbnail_url,
        'published_at', vc.published_at,
        'channel_username', cr.username,
        'channel_name', cr.name,
        'channel_avatar_url', cr.avatar_url,
        'channel_url', cr.source_url,
        'is_saved', exists(select 1 from public.saves s where s.user_id = p_user_id and s.content_id = vc.id),
        'quality', coalesce(cf.normalized_quality, vc.quality_score, 0.5),
        'category', coalesce(pt.name, pt.slug, 'تلگرام')
      ) as post_row
    from visible_contents vc
    join creator_row cr on cr.id = vc.creator_id
    left join public.discovery_content_features cf on cf.content_id = vc.id
    left join lateral (
      select t.name, t.slug
      from public.content_topics ct
      join public.topics t on t.id = ct.topic_id
      where ct.content_id = vc.id
      order by ct.relevance desc nulls last, t.name
      limit 1
    ) pt on true
    order by vc.published_at desc nulls last, vc.id
    limit greatest(1, least(coalesce(p_limit,18), 40))
  ) p
),
target_topic_total as (
  select greatest(coalesce(sum(weight),0), 0.0001)::double precision as total
  from topic_weights
),
other_topics as (
  select c.creator_id, ct.topic_id, sum(coalesce(ct.relevance,0.5))::double precision as weight
  from public.contents c
  join public.content_topics ct on ct.content_id = c.id
  join public.creators cr on cr.id = c.creator_id
  where c.creator_id <> p_creator_id
    and cr.is_active = true
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
  group by c.creator_id, ct.topic_id
),
similar_scored as (
  select
    cr.id as creator_id,
    cr.name as title,
    cr.username,
    cr.bio,
    cr.avatar_url,
    cr.source_url,
    cr.verified,
    exists(select 1 from public.follows f where f.user_id = p_user_id and f.creator_id = cr.id) as following,
    count(distinct c.id)::int as posts_count,
    least(1.0, greatest(0.0,
      coalesce(sum(least(ot.weight, tw.weight)),0) / (select total from target_topic_total)
    ))::double precision as topic_overlap,
    coalesce(avg(coalesce(cf.normalized_quality, c.quality_score, 0.5)),0.5)::double precision as quality,
    public.discovery_freshness_factor(max(c.published_at))::double precision as freshness
  from public.creators cr
  left join public.contents c on c.creator_id = cr.id
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
  left join public.discovery_content_features cf on cf.content_id = c.id
  left join other_topics ot on ot.creator_id = cr.id
  left join topic_weights tw on tw.id = ot.topic_id
  where cr.id <> p_creator_id and cr.is_active = true
  group by cr.id, cr.name, cr.username, cr.bio, cr.avatar_url, cr.source_url, cr.verified
),
similar_json as (
  select coalesce(jsonb_agg(item order by score desc, title), '[]'::jsonb) as value
  from (
    select
      jsonb_build_object(
        'creator_id', creator_id,
        'title', coalesce(title, username, 'Telegram'),
        'username', username,
        'bio', bio,
        'avatar_url', avatar_url,
        'source_url', source_url,
        'verified', verified,
        'following', following,
        'posts_count', posts_count,
        'topic_overlap', topic_overlap,
        'quality', quality,
        'freshness', freshness,
        'score', least(1.0, greatest(0.0, 0.58*topic_overlap + 0.24*quality + 0.18*freshness))
      ) as item,
      coalesce(title, username, 'Telegram') as title,
      least(1.0, greatest(0.0, 0.58*topic_overlap + 0.24*quality + 0.18*freshness)) as score
    from similar_scored
    where posts_count > 0
    order by score desc, title
    limit 6
  ) q
)
select case
  when not exists(select 1 from creator_row)
    then jsonb_build_object('found', false)
  else jsonb_build_object(
    'found', true,
    'creator', (
      select jsonb_build_object(
        'creator_id', id,
        'title', coalesce(name, username, 'Telegram'),
        'username', username,
        'bio', bio,
        'avatar_url', avatar_url,
        'source_url', source_url,
        'verified', verified
      ) from creator_row
    ),
    'following', exists(
      select 1 from public.follows f
      where f.user_id = p_user_id and f.creator_id = p_creator_id
    ),
    'stats', (
      select jsonb_build_object(
        'posts_count', posts_count,
        'followers_count', followers_count,
        'saves_count', saves_count,
        'views_30d', views_30d,
        'unique_viewers_30d', unique_viewers_30d,
        'recent_posts', recent_posts,
        'avg_quality', avg_quality,
        'last_post_at', last_post_at
      ) from profile_stats
    ),
    'topics', (select value from topics_json),
    'posts', (select value from posts_json),
    'similar', (select value from similar_json),
    'algorithm', 'channel-topic-quality-freshness-v1'
  )
end;
$function$;

revoke all on function public.get_channel_profile_v1(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.get_channel_profile_v1(uuid,uuid,integer) to service_role;
