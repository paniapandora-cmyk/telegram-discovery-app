create or replace function public.trigger_telegram_source_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  if coalesce(new.enabled,false) is not true then
    return new;
  end if;

  perform net.http_post(
    url := 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-public-sync-v1',
    body := jsonb_build_object('source_id', new.id),
    params := jsonb_build_object('source_id', new.id),
    headers := jsonb_build_object('Content-Type','application/json'),
    timeout_milliseconds := 20000
  );
  return new;
end;
$$;

create or replace function public.enqueue_due_telegram_source_syncs_v1()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec record;
  queued integer := 0;
begin
  for rec in
    select s.id, s.last_synced_at
    from public.telegram_sources s
    where s.enabled = true
      and s.username is not null
      and (s.last_synced_at is null or s.last_synced_at < now() - interval '2 minutes')
      and not exists (
        select 1
        from public.telegram_sync_runs r
        where r.source_id = s.id
          and r.status = 'running'
          and r.started_at > now() - interval '10 minutes'
      )
    order by s.last_synced_at nulls first, s.created_at asc
    limit 25
  loop
    perform net.http_post(
      url := 'https://jmxlwocemvjwkztbasja.supabase.co/functions/v1/telegram-public-sync-v1',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('source_id', rec.id),
      timeout_milliseconds := 120000
    );
    queued := queued + 1;
  end loop;
  return queued;
end;
$$;
