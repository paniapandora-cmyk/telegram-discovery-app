-- Counts actual private /start messages only; no historical estimates.
create table if not exists public.bot_start_events (
  chat_id bigint not null,
  message_id bigint not null,
  telegram_update_id bigint not null,
  telegram_user_id bigint not null,
  start_payload text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);
create index if not exists bot_start_events_user_time_idx
  on public.bot_start_events (telegram_user_id, occurred_at);
create index if not exists bot_start_events_time_idx
  on public.bot_start_events (occurred_at);
alter table public.bot_start_events enable row level security;
revoke all on public.bot_start_events from public, anon, authenticated;
grant select, insert on public.bot_start_events to service_role;

CREATE OR REPLACE FUNCTION public.get_bot_owner_stats_v1(p_telegram_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean;
  v_result jsonb;
begin
  select exists(
    select 1
    from public.bot_owners bo
    where bo.telegram_user_id = p_telegram_user_id
      and bo.is_active = true
  ) into v_allowed;

  if not v_allowed then
    raise exception 'BOT_OWNER_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'total_users', count(*),
    'unique_telegram_users', count(distinct u.telegram_user_id) filter (where u.telegram_user_id is not null),
    'active_flag_users', count(*) filter (where u.is_active = true),
    'new_today', count(*) filter (where u.created_at >= date_trunc('day', now())),
    'new_7d', count(*) filter (where u.created_at >= now() - interval '7 days'),
    'new_30d', count(*) filter (where u.created_at >= now() - interval '30 days'),
    'active_7d', count(*) filter (where u.updated_at >= now() - interval '7 days'),
    'active_30d', count(*) filter (where u.updated_at >= now() - interval '30 days'),
    'onboarded_users', count(*) filter (where u.onboarding_done = true),
    'generated_at', now()
  ) into v_result
  from public.users u;

  v_result := v_result || (
    select jsonb_build_object(
      'bot_starts_total', count(*),
      'bot_start_users_total', count(distinct s.telegram_user_id),
      'bot_starts_today', count(*) filter (where s.occurred_at >= (date_trunc('day', now() at time zone 'Asia/Tehran') at time zone 'Asia/Tehran')),
      'bot_start_users_24h', count(distinct s.telegram_user_id) filter (where s.occurred_at >= now() - interval '24 hours'),
      'bot_starts_non_owner', count(*) filter (where not exists (select 1 from public.bot_owners b where b.telegram_user_id=s.telegram_user_id and b.is_active)),
      'bot_start_users_non_owner', count(distinct s.telegram_user_id) filter (where not exists (select 1 from public.bot_owners b where b.telegram_user_id=s.telegram_user_id and b.is_active)),
      'bot_start_last_at', max(s.occurred_at)
    ) from public.bot_start_events s
  );
  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'feed_sessions_7d', (
      select count(*) from public.discovery_feed_sessions s
      where s.created_at >= now() - interval '7 days'
    ),
    'feed_sessions_30d', (
      select count(*) from public.discovery_feed_sessions s
      where s.created_at >= now() - interval '30 days'
    ),
    'event_users_7d', (
      select count(distinct e.user_id) from public.events e
      where e.created_at >= now() - interval '7 days'
    ),
    'event_users_30d', (
      select count(distinct e.user_id) from public.events e
      where e.created_at >= now() - interval '30 days'
    )
  );
end;
$function$;
