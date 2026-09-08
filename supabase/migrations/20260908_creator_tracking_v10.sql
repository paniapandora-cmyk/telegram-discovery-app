
-- Creator tracking v10
-- Stable per-channel invite + server-side click dedupe + robust analytics.

create table if not exists public.creator_channel_tracking_links (
  creator_channel_id uuid primary key
    references public.creator_channels(id) on delete cascade,
  creator_id uuid not null
    references public.creators(id) on delete cascade,
  telegram_chat_id bigint not null,
  invite_link_hash text not null,
  invite_link_name text not null,
  invite_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists
  creator_channel_tracking_links_hash_uidx
on public.creator_channel_tracking_links(invite_link_hash);

alter table public.creator_channel_tracking_links enable row level security;

alter table public.creator_referrals
  add column if not exists creator_channel_id uuid
    references public.creator_channels(id) on delete set null;

alter table public.creator_referrals
  add column if not exists click_key text;

alter table public.creator_referrals
  add column if not exists source text;

alter table public.creator_referrals
  drop constraint if exists creator_referrals_status_check;

alter table public.creator_referrals
  add constraint creator_referrals_status_check
  check (status in ('CLICKED','JOINED','LEFT','EXPIRED','DUPLICATE'));

alter table public.creator_referrals
  drop constraint if exists creator_referrals_invite_link_hash_key;

create index if not exists
  creator_referrals_invite_link_hash_idx
on public.creator_referrals(invite_link_hash);

create unique index if not exists
  creator_referrals_user_click_key_uidx
on public.creator_referrals(user_id, click_key);

create index if not exists
  creator_referrals_member_lookup_idx
on public.creator_referrals(
  telegram_chat_id,
  telegram_user_id,
  status,
  clicked_at desc
);

create index if not exists
  creator_referrals_channel_time_idx
on public.creator_referrals(
  creator_channel_id,
  created_at desc
);

-- Mark only very-close historical duplicate CLICKED rows as DUPLICATE.
-- Keep the first click; exclude the extra rows from analytics.
with ordered as (
  select
    id,
    created_at,
    lag(created_at) over (
      partition by creator_id, user_id
      order by created_at, id
    ) as previous_created_at
  from public.creator_referrals
  where upper(coalesce(status,'')) = 'CLICKED'
),
dupes as (
  select id
  from ordered
  where previous_created_at is not null
    and created_at - previous_created_at <= interval '5 seconds'
)
update public.creator_referrals r
set
  status = 'DUPLICATE',
  updated_at = now(),
  metadata = coalesce(r.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'deduped_by', 'creator_tracking_v10',
      'deduped_at', now()
    )
where r.id in (select id from dupes);

create or replace function public.get_creator_analytics_v4(
  p_user_id uuid,
  p_creator_channel_id uuid default null::uuid,
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
set search_path to 'public'
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
    ch.id as channel_id,
    ch.creator_id,
    ch.username,
    ch.title,
    ch.is_bot_admin,
    ch.verified,

    coalesce(ev.views,0)::bigint as views,
    coalesce(ev.unique_viewers,0)::bigint as unique_viewers,

    coalesce(ce.telegram_opens,0)::bigint as telegram_opens,

    coalesce(ref.join_clicks,0)::bigint as join_clicks,
    coalesce(ref.telegram_joins,0)::bigint as telegram_joins,
    coalesce(ref.active_joins,0)::bigint as active_joins,
    coalesce(ref.leaves,0)::bigint as leaves,

    coalesce(sv.saves,0)::bigint as saves,
    coalesce(ce.starts_bot,0)::bigint as starts_bot,

    case
      when coalesce(ev.views,0)=0 then 0
      else coalesce(ref.join_clicks,0)::double precision
        / ev.views::double precision
    end as ctr,

    case
      when coalesce(ref.join_clicks,0)=0 then 0
      else coalesce(ref.telegram_joins,0)::double precision
        / ref.join_clicks::double precision
    end as join_conversion_rate,

    current_date - (
      greatest(least(coalesce(p_days,30),365),1)-1
    ) as range_start,

    current_date as range_end

  from owned ch

  left join lateral (
    select
      count(*) filter (
        where upper(e.event_type) in ('VIEW','LONG_VIEW')
      ) as views,

      count(distinct e.user_id) filter (
        where upper(e.event_type) in ('VIEW','LONG_VIEW')
      ) as unique_viewers

    from public.events e
    join public.contents c
      on c.id = e.content_id
    where c.creator_id = ch.creator_id
      and e.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days,30),365),1
        )
      )
  ) ev on true

  left join lateral (
    select count(*) as saves
    from public.saves s
    join public.contents c
      on c.id = s.content_id
    where c.creator_id = ch.creator_id
      and s.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days,30),365),1
        )
      )
  ) sv on true

  left join lateral (
    select
      count(*) filter (
        where upper(coalesce(r.status,'')) in (
          'CLICKED','JOINED','LEFT'
        )
      ) as join_clicks,

      count(*) filter (
        where r.joined_at is not null
          and upper(coalesce(r.status,'')) <> 'DUPLICATE'
      ) as telegram_joins,

      count(*) filter (
        where upper(coalesce(r.status,'')) = 'JOINED'
          and r.left_at is null
      ) as active_joins,

      count(*) filter (
        where r.left_at is not null
          and upper(coalesce(r.status,'')) <> 'DUPLICATE'
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
          least(coalesce(p_days,30),365),1
        )
      )
  ) ref on true

  left join lateral (
    select
      count(*) filter (
        where upper(ce.event_type) in (
          'CLICK_TELEGRAM',
          'TELEGRAM_OPEN'
        )
      ) as telegram_opens,

      count(*) filter (
        where upper(ce.event_type) = 'START_BOT'
      ) as starts_bot

    from public.creator_events ce
    where ce.creator_channel_id = ch.id
      and ce.created_at >= now() - make_interval(
        days => greatest(
          least(coalesce(p_days,30),365),1
        )
      )
  ) ce on true

  order by
    coalesce(ev.views,0) desc,
    ch.created_at asc;
$function$;
