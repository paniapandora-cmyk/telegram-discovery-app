alter table public.telegram_sources
  add column if not exists sync_request_token uuid,
  add column if not exists sync_request_until timestamptz;

create or replace function public.claim_telegram_sync_request_v1(p_source_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare claimed boolean := false;
begin
  update public.telegram_sources
  set sync_request_token=null,
      sync_request_until=null,
      updated_at=now()
  where id=p_source_id
    and sync_request_token=p_token
    and sync_request_until is not null
    and sync_request_until > now();
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_telegram_sync_request_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_sync_request_v1(uuid,uuid) to service_role;

create or replace function public.trigger_telegram_source_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare request_token uuid := gen_random_uuid();
begin
  if coalesce(new.enabled,false) is not true then return new; end if;

  update public.telegram_sources
  set sync_request_token=request_token,
      sync_request_until=now()+interval '5 minutes',
      updated_at=now()
  where id=new.id;

  perform net.http_post(
    url := 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-public-sync-v2',
    body := jsonb_build_object('source_id',new.id,'request_token',request_token),
    params := jsonb_build_object('source_id',new.id),
    headers := jsonb_build_object('Content-Type','application/json'),
    timeout_milliseconds := 120000
  );
  return new;
end;
$$;

revoke all on function public.trigger_telegram_source_sync() from public, anon, authenticated;
grant execute on function public.trigger_telegram_source_sync() to service_role;

create or replace function public.enqueue_due_telegram_source_syncs_v1()
returns integer
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare rec record; queued integer := 0; request_token uuid;
begin
  for rec in
    select s.id
    from public.telegram_sources s
    where s.enabled=true and s.username is not null
      and (s.last_synced_at is null or s.last_synced_at < now()-interval '2 minutes')
      and not exists (
        select 1 from public.telegram_sync_runs r
        where r.source_id=s.id and r.status='running' and r.started_at>now()-interval '10 minutes'
      )
    order by s.last_synced_at nulls first,s.created_at asc
    limit 6
  loop
    request_token := gen_random_uuid();
    update public.telegram_sources
    set sync_request_token=request_token,
        sync_request_until=now()+interval '5 minutes',
        updated_at=now()
    where id=rec.id;

    perform net.http_post(
      url := 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-public-sync-v2',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('source_id',rec.id,'request_token',request_token),
      timeout_milliseconds := 120000
    );
    queued := queued+1;
  end loop;
  return queued;
end;
$$;

revoke all on function public.enqueue_due_telegram_source_syncs_v1() from public, anon, authenticated;
grant execute on function public.enqueue_due_telegram_source_syncs_v1() to service_role;

revoke all on function public.get_explore_discovery_page_v2(uuid,integer,uuid[]) from public, anon, authenticated;
grant execute on function public.get_explore_discovery_page_v2(uuid,integer,uuid[]) to service_role;

revoke all on function public.get_explore_discovery_v4(uuid,integer,uuid[]) from public, anon, authenticated;
grant execute on function public.get_explore_discovery_v4(uuid,integer,uuid[]) to service_role;

alter view public.creator_growth_summary set (security_invoker=true);
revoke all on table public.creator_growth_summary from public, anon, authenticated;
grant select on table public.creator_growth_summary to service_role;
