-- Apply before deploying telegram-source-sync-v2 v15.
-- Zero starts a complete history scan; existing content is preserved.
alter table public.telegram_sources
  add column if not exists history_before_id bigint not null default 0,
  add column if not exists history_complete boolean not null default false,
  add column if not exists sync_lease_token uuid,
  add column if not exists sync_lease_until timestamptz;

create or replace function public.acquire_telegram_sync_lease(p_source_id uuid, p_token uuid)
returns boolean language sql security definer set search_path = public
as $$
  with acquired as (
    update public.telegram_sources
    set sync_lease_token = p_token, sync_lease_until = now() + interval '10 minutes'
    where id = p_source_id and enabled = true
      and (sync_lease_until is null or sync_lease_until < now())
    returning id
  ) select exists(select 1 from acquired);
$$;
revoke all on function public.acquire_telegram_sync_lease(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_telegram_sync_lease(uuid,uuid) to service_role;
