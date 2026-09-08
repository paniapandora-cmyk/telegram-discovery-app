-- Restore the original product contract:
-- Creator membership metrics only include tracked Discovery referrals.

create or replace function public.get_creator_dashboard_v3(
  p_user_id uuid
)
returns table(
  creator_id uuid,
  creator_name text,
  creator_username text,
  avatar_url text,
  content_count bigint,
  total_impressions bigint,
  total_opens bigint,
  total_views bigint,
  unique_viewers bigint,
  total_telegram_opens bigint,
  total_saves bigint,
  total_follows bigint,
  telegram_join_clicks bigint,
  telegram_joins bigint,
  telegram_active_joins bigint,
  telegram_leaves bigint,
  save_rate double precision,
  join_conversion_rate double precision,
  impressions_7d bigint,
  views_7d bigint,
  joins_7d bigint,
  impressions_30d bigint,
  avg_quality_score double precision,
  last_content_at timestamptz
)
language sql
stable
set search_path = public
as $function$
  select
    cr.id,
    cr.name,
    cr.username,
    cr.avatar_url,
    coalesce(cm.content_count, 0),
    coalesce(im.total_impressions, 0),
    coalesce(em.total_opens, 0),
    coalesce(em.total_views, 0),
    coalesce(em.unique_viewers, 0),
    coalesce(em.total_telegram_opens, 0),
    coalesce(sm.total_saves, 0),
    coalesce(fm.total_follows, 0),
    coalesce(rm.telegram_join_clicks, 0),
    coalesce(rm.telegram_joins, 0),
    coalesce(rm.telegram_active_joins, 0),
    coalesce(rm.telegram_leaves, 0),
    case
      when coalesce(im.total_impressions, 0) = 0 then 0
      else coalesce(sm.total_saves, 0)::double precision
        / im.total_impressions::double precision
    end,
    case
      when coalesce(rm.telegram_join_clicks, 0) = 0 then 0
      else coalesce(rm.telegram_joins, 0)::double precision
        / rm.telegram_join_clicks::double precision
    end,
    coalesce(im.impressions_7d, 0),
    coalesce(em.views_7d, 0),
    coalesce(rm.joins_7d, 0),
    coalesce(im.impressions_30d, 0),
    coalesce(cm.avg_quality_score, 0),
    cm.last_content_at
  from public.creator_claims cc
  join public.creators cr on cr.id = cc.creator_id
  left join lateral (
    select
      count(*) as content_count,
      avg(c.quality_score) as avg_quality_score,
      max(c.published_at) as last_content_at
    from public.contents c
    where c.creator_id = cr.id
  ) cm on true
  left join lateral (
    select
      count(*) as total_impressions,
      count(*) filter (
        where i.created_at >= now() - interval '7 days'
      ) as impressions_7d,
      count(*) filter (
        where i.created_at >= now() - interval '30 days'
      ) as impressions_30d
    from public.impressions i
    join public.contents c on c.id = i.content_id
    where c.creator_id = cr.id
  ) im on true
  left join lateral (
    select
      count(*) filter (
        where upper(e.event_type) = 'OPEN'
      ) as total_opens,
      count(*) filter (
        where upper(e.event_type) in ('VIEW', 'LONG_VIEW')
      ) as total_views,
      count(distinct e.user_id) filter (
        where upper(e.event_type) in ('VIEW', 'LONG_VIEW')
      ) as unique_viewers,
      count(*) filter (
        where upper(e.event_type) = 'TELEGRAM_OPEN'
      ) as total_telegram_opens,
      count(*) filter (
        where upper(e.event_type) in ('VIEW', 'LONG_VIEW')
          and e.created_at >= now() - interval '7 days'
      ) as views_7d
    from public.events e
    join public.contents c on c.id = e.content_id
    where c.creator_id = cr.id
  ) em on true
  left join lateral (
    select count(*) as total_saves
    from public.saves s
    join public.contents c on c.id = s.content_id
    where c.creator_id = cr.id
  ) sm on true
  left join lateral (
    select count(*) as total_follows
    from public.follows f
    where f.creator_id = cr.id
  ) fm on true
  left join lateral (
    select
      count(*) filter (
        where upper(coalesce(r.status, '')) in (
          'CLICKED', 'JOINED', 'LEFT'
        )
      ) as telegram_join_clicks,
      count(*) filter (
        where r.joined_at is not null
          and upper(coalesce(r.status, '')) <> 'DUPLICATE'
      ) as telegram_joins,
      count(*) filter (
        where upper(coalesce(r.status, '')) = 'JOINED'
          and r.left_at is null
      ) as telegram_active_joins,
      count(*) filter (
        where r.left_at is not null
          and upper(coalesce(r.status, '')) <> 'DUPLICATE'
      ) as telegram_leaves,
      count(*) filter (
        where r.joined_at >= now() - interval '7 days'
          and upper(coalesce(r.status, '')) <> 'DUPLICATE'
      ) as joins_7d
    from public.creator_referrals r
    where r.creator_id = cr.id
  ) rm on true
  where cc.user_id = p_user_id
    and upper(cc.status) = 'APPROVED'
  order by coalesce(im.total_impressions, 0) desc, cr.name;
$function$;

create or replace function public.get_creator_analytics_v4(
  p_user_id uuid,
  p_creator_channel_id uuid default null,
  p_days integer default 30
)
returns table(
  channel_id uuid,
  creator_id uuid,
  username text,
  title text,
  is_bot_admin boolean,
  verified boolean,
  views bigint,
  unique_viewers bigint,
  telegram_opens bigint,
  join_clicks bigint,
  telegram_joins bigint,
  active_joins bigint,
  leaves bigint,
  saves bigint,
  starts_bot bigint,
  ctr double precision,
  join_conversion_rate double precision,
  range_start date,
  range_end date
)
language sql
stable
set search_path = public
as $function$
  with owned as (
    select ch.*
    from public.creator_channels ch
    where ch.creator_user_id = p_user_id
      and (
        p_creator_channel_id is null
        or ch.id = p_creator_channel_id
      )
  )
  select
    ch.id,
    ch.creator_id,
    ch.username,
    ch.title,
    ch.is_bot_admin,
    ch.verified,
    coalesce(ev.views, 0)::bigint,
    coalesce(ev.unique_viewers, 0)::bigint,
    coalesce(ce.telegram_opens, 0)::bigint,
    coalesce(ref.join_clicks, 0)::bigint,
    coalesce(ref.telegram_joins, 0)::bigint,
    coalesce(ref.active_joins, 0)::bigint,
    coalesce(ref.leaves, 0)::bigint,
    coalesce(sv.saves, 0)::bigint,
    coalesce(ce.starts_bot, 0)::bigint,
    case
      when coalesce(ev.views, 0) = 0 then 0
      else coalesce(ref.join_clicks, 0)::double precision
        / ev.views::double precision
    end,
    case
      when coalesce(ref.join_clicks, 0) = 0 then 0
      else coalesce(ref.telegram_joins, 0)::double precision
        / ref.join_clicks::double precision
    end,
    current_date - (
      greatest(least(coalesce(p_days, 30), 365), 1) - 1
    ),
    current_date
  from owned ch
  left join lateral (
    select
      count(*) filter (
        where upper(e.event_type) in ('VIEW', 'LONG_VIEW')
      ) as views,
      count(distinct e.user_id) filter (
        where upper(e.event_type) in ('VIEW', 'LONG_VIEW')
      ) as unique_viewers
    from public.events e
    join public.contents c on c.id = e.content_id
    where c.creator_id = ch.creator_id
      and e.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days, 30), 365), 1
        )
      )
  ) ev on true
  left join lateral (
    select count(*) as saves
    from public.saves s
    join public.contents c on c.id = s.content_id
    where c.creator_id = ch.creator_id
      and s.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days, 30), 365), 1
        )
      )
  ) sv on true
  left join lateral (
    select
      count(*) filter (
        where upper(coalesce(r.status, '')) in (
          'CLICKED', 'JOINED', 'LEFT'
        )
      ) as join_clicks,
      count(*) filter (
        where r.joined_at is not null
          and upper(coalesce(r.status, '')) <> 'DUPLICATE'
      ) as telegram_joins,
      count(*) filter (
        where upper(coalesce(r.status, '')) = 'JOINED'
          and r.left_at is null
      ) as active_joins,
      count(*) filter (
        where r.left_at is not null
          and upper(coalesce(r.status, '')) <> 'DUPLICATE'
      ) as leaves
    from public.creator_referrals r
    where (
      r.creator_channel_id = ch.id
      or (
        r.creator_channel_id is null
        and r.creator_id = ch.creator_id
      )
    )
      and r.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days, 30), 365), 1
        )
      )
  ) ref on true
  left join lateral (
    select
      count(*) filter (
        where upper(ce.event_type) in (
          'CLICK_TELEGRAM', 'TELEGRAM_OPEN'
        )
      ) as telegram_opens,
      count(*) filter (
        where upper(ce.event_type) = 'START_BOT'
      ) as starts_bot
    from public.creator_events ce
    where ce.creator_channel_id = ch.id
      and ce.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days, 30), 365), 1
        )
      )
  ) ce on true
  order by coalesce(ev.views, 0) desc, ch.created_at asc;
$function$;
