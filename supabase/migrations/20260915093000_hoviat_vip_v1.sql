-- Only server-verified members qualify. Existing bot starts are not backfilled.
create table public.discovery_access_policy_v1 (
  singleton boolean primary key default true check (singleton),
  eligible_since timestamptz not null default now()
);
insert into public.discovery_access_policy_v1 default values;
alter table public.discovery_access_policy_v1 enable row level security;
revoke all on public.discovery_access_policy_v1 from public, anon, authenticated;
grant select on public.discovery_access_policy_v1 to service_role;
create table public.discovery_membership_v1 (
  telegram_user_id bigint primary key check (telegram_user_id > 0),
  verified_at timestamptz not null default now()
);
create table public.discovery_verified_invites_v1 (
  invitee_id bigint primary key check (invitee_id > 0),
  inviter_id bigint not null check (inviter_id > 0 and inviter_id <> invitee_id),
  token text not null references public.growth_links(token),
  verified_at timestamptz not null default now()
);
create index on public.discovery_verified_invites_v1(inviter_id, verified_at);
create table public.discovery_ai_daily_v1 (
  telegram_user_id bigint not null,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (telegram_user_id, day)
);
alter table public.discovery_membership_v1 enable row level security;
alter table public.discovery_verified_invites_v1 enable row level security;
alter table public.discovery_ai_daily_v1 enable row level security;
revoke all on public.discovery_membership_v1, public.discovery_verified_invites_v1, public.discovery_ai_daily_v1 from public, anon, authenticated;
grant all on public.discovery_membership_v1, public.discovery_verified_invites_v1, public.discovery_ai_daily_v1 to service_role;

create function public.discovery_access_v1(p_user_id bigint, p_verify boolean default false, p_consume_ai boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_first public.bot_start_events%rowtype;
  v_link public.growth_links%rowtype;
  v_count integer;
  v_limit integer;
  v_used integer := 0;
  v_allowed boolean := true;
  v_legacy boolean := false;
  v_day date := (now() at time zone 'Asia/Tehran')::date;
begin
  if p_user_id is null or p_user_id <= 0 then raise exception 'invalid_user'; end if;
  -- Serialize qualification and quota operations for this account.
  perform pg_advisory_xact_lock(p_user_id);
  if p_verify then
    -- The first ever server-recorded private /start determines attribution.
    -- Query parameters and subsequent start links cannot change it.
    if not exists(select 1 from public.discovery_membership_v1 where telegram_user_id = p_user_id) then
      select * into v_first from public.bot_start_events where telegram_user_id = p_user_id
        order by occurred_at, telegram_update_id limit 1;
      select * into v_link from public.growth_links where token = v_first.start_payload
        and kind = 'invite' and is_active and owner_telegram_user_id <> p_user_id
        and created_at <= v_first.occurred_at;
      if v_link.id is not null and v_first.occurred_at >= now() - interval '7 days'
         and v_first.occurred_at >= (select eligible_since from public.discovery_access_policy_v1 where singleton)
         and not exists(select 1 from public.users where telegram_user_id = p_user_id and created_at < v_first.occurred_at)
      then
        insert into public.discovery_verified_invites_v1(invitee_id, inviter_id, token)
        values(p_user_id, v_link.owner_telegram_user_id, v_link.token)
        on conflict(invitee_id) do nothing;
      end if;
    end if;
    insert into public.discovery_membership_v1(telegram_user_id) values(p_user_id)
      on conflict(telegram_user_id) do update set verified_at = now();
  end if;
  select count(*) into v_count from public.discovery_verified_invites_v1 where inviter_id = p_user_id;
  select exists(select 1 from public.users where telegram_user_id = p_user_id and created_at <
    (select eligible_since from public.discovery_access_policy_v1 where singleton))
    or exists(select 1 from public.bot_start_events where telegram_user_id = p_user_id and occurred_at <
    (select eligible_since from public.discovery_access_policy_v1 where singleton)) into v_legacy;
  v_limit := case when v_count >= 3 then 30 when v_count = 2 then 15 when v_count = 1 then 10 else 5 end;
  if v_legacy then v_limit := 30; end if;
  if p_consume_ai then
    if not exists(select 1 from public.discovery_membership_v1 where telegram_user_id = p_user_id and verified_at > now() - interval '2 minutes') then
      raise exception 'membership_verification_required';
    end if;
    insert into public.discovery_ai_daily_v1(telegram_user_id, day, used) values(p_user_id, v_day, 0)
      on conflict do nothing;
    update public.discovery_ai_daily_v1 set used = used + 1
      where telegram_user_id = p_user_id and day = v_day and used < v_limit;
    v_allowed := found;
  end if;
  select coalesce(used, 0) into v_used from public.discovery_ai_daily_v1 where telegram_user_id = p_user_id and day = v_day;
  return jsonb_build_object('verified_invites', v_count, 'vip', v_count >= 3, 'legacy', v_legacy,
    'level', least(v_count, 3), 'ai_daily_limit', v_limit, 'ai_used', coalesce(v_used, 0),
    'ai_remaining', greatest(0, v_limit - coalesce(v_used, 0)), 'allowed', v_allowed,
    'reset_timezone', 'Asia/Tehran');
end;
$$;
revoke all on function public.discovery_access_v1(bigint, boolean, boolean) from public, anon, authenticated;
grant execute on function public.discovery_access_v1(bigint, boolean, boolean) to service_role;
