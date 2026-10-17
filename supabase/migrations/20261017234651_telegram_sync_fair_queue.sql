-- Keep the four-request load ceiling, but let every enabled source get a turn.
-- Record dispatch separately: failures must also move to the back of the queue.
alter table public.telegram_sources
  add column if not exists last_sync_requested_at timestamptz;

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
    where s.enabled=true and nullif(trim(s.username),'') is not null
      and (s.last_synced_at is null or s.last_synced_at < now()-interval '2 minutes')
      and (s.last_sync_requested_at is null or s.last_sync_requested_at < now()-interval '2 minutes')
      and (s.sync_request_until is null or s.sync_request_until < now())
      and (s.sync_lease_until is null or s.sync_lease_until < now())
      and not exists (
        select 1 from public.telegram_sync_runs r
        where r.source_id=s.id and r.status='running' and r.started_at>now()-interval '10 minutes'
      )
    order by greatest(s.last_synced_at,s.last_sync_requested_at) asc nulls first,
      s.discovery_priority desc nulls last, s.created_at asc, s.id
    limit 4
    for update of s skip locked
  loop
    request_token := gen_random_uuid();
    update public.telegram_sources
    set sync_request_token=request_token,
        sync_request_until=now()+interval '5 minutes',
        last_sync_requested_at=now(),
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
