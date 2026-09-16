create or replace function public.claim_embedding_jobs(p_batch integer default 12)
returns table(content_id uuid, text_content text)
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  -- Recover abandoned work without touching the full queue.
  update public.discovery_embedding_jobs j
  set status='PENDING',
      last_error=left(concat_ws('; ',nullif(j.last_error,''),'reclaimed_stale_processing'),2000),
      requested_at=now()
  where j.status='PROCESSING'
    and j.requested_at < now()-interval '15 minutes';

  -- Retry only a bounded number of failed jobs per claim cycle.
  with retryable as (
    select j.content_id
    from public.discovery_embedding_jobs j
    where j.status='FAILED' and j.attempts < 5
    order by j.requested_at desc
    limit 100
    for update skip locked
  )
  update public.discovery_embedding_jobs j
  set status='PENDING', requested_at=now()
  from retryable r
  where j.content_id=r.content_id;

  return query
  with queue as materialized (
    select j.content_id, j.requested_at
    from public.discovery_embedding_jobs j
    where j.status='PENDING'
    order by j.requested_at desc
    limit greatest(least(p_batch,50),1) * 8
    for update skip locked
  ),
  ranked as materialized (
    select q.content_id
    from queue q
    join public.contents c on c.id=q.content_id
    where nullif(btrim(coalesce(c.text_content,'')), '') is not null
    order by
      case when c.published_at >= now()-interval '14 days' then 0 when c.published_at is null then 2 else 1 end,
      coalesce(c.quality_score,0.5) desc,
      c.published_at desc nulls last,
      q.requested_at desc
    limit greatest(least(p_batch,50),1)
  ),
  claimed as (
    update public.discovery_embedding_jobs j
    set status='PROCESSING', attempts=j.attempts+1, requested_at=now()
    where j.content_id in (select r.content_id from ranked r)
      and j.status='PENDING'
    returning j.content_id
  )
  select c.content_id, x.text_content
  from claimed c
  join public.contents x on x.id=c.content_id;
end;
$$;

revoke all on function public.claim_embedding_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_embedding_jobs(integer) to service_role;
