create index if not exists discovery_embedding_jobs_status_requested_idx
  on public.discovery_embedding_jobs(status, requested_at desc)
  include (content_id, attempts);

create or replace function public.claim_embedding_jobs(p_batch integer default 8)
returns table(content_id uuid, text_content text)
language sql
security definer
set search_path to 'public','pg_catalog'
as $$
  update public.discovery_embedding_jobs j
  set status='SKIPPED_NO_TEXT',
      completed_at=coalesce(j.completed_at, now()),
      last_error='no_text_content'
  from public.contents c
  where c.id=j.content_id
    and j.status in ('PENDING','FAILED','PROCESSING')
    and nullif(btrim(coalesce(c.text_content,'')), '') is null;

  update public.discovery_embedding_jobs
  set status='PENDING',
      last_error=left(concat_ws('; ',nullif(last_error,''),'reclaimed_stale_processing'),2000),
      requested_at=now()
  where status='PROCESSING'
    and requested_at < now()-interval '15 minutes';

  with queue as materialized (
    select q.content_id, q.requested_at
    from public.discovery_embedding_jobs q
    where q.status='PENDING' or (q.status='FAILED' and q.attempts < 5)
    order by q.requested_at desc
    limit 1000
  ),
  ranked as materialized (
    select q.content_id
    from queue q
    join public.contents c on c.id=q.content_id
    left join public.discovery_content_features f on f.content_id=q.content_id
    where nullif(btrim(coalesce(c.text_content,'')), '') is not null
    order by
      case
        when c.published_at >= now()-interval '14 days' then 0
        when c.published_at is null then 2
        else 1
      end,
      coalesce(f.normalized_quality,c.quality_score,0.5) desc,
      c.published_at desc nulls last,
      q.requested_at desc
    limit greatest(least(p_batch,50),1)
  ),
  claimed as (
    update public.discovery_embedding_jobs j
    set status='PROCESSING',
        attempts=j.attempts+1,
        requested_at=now()
    where j.content_id in (select r.content_id from ranked r)
      and (j.status='PENDING' or (j.status='FAILED' and j.attempts < 5))
    returning j.content_id
  )
  select c.content_id, x.text_content
  from claimed c
  join public.contents x on x.id=c.content_id;
$$;

revoke all on function public.claim_embedding_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_embedding_jobs(integer) to service_role;
