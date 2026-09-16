create index if not exists feedback_content_user_created_idx
  on public.feedback(content_id,user_id,created_at desc);

create index if not exists reports_content_status_user_idx
  on public.reports(content_id,status,user_id,created_at desc);

create or replace function public.capture_report_feedback_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  if new.feedback_type::text <> 'REPORT' or new.content_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.reports r
    where r.user_id=new.user_id
      and r.content_id=new.content_id
      and coalesce(r.status,'OPEN')='OPEN'
  ) then
    insert into public.reports(user_id,content_id,creator_id,reason,description,status,created_at)
    values(new.user_id,new.content_id,new.creator_id,'USER_REPORT',left(new.reason,1000),'OPEN',now());
  end if;

  return new;
end;
$$;

create or replace function public.quarantine_content_after_reports_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  reporter_count integer;
  previous_rights text;
begin
  if new.content_id is null or coalesce(new.status,'OPEN') <> 'OPEN' then
    return new;
  end if;

  select count(distinct r.user_id)::integer
    into reporter_count
  from public.reports r
  where r.content_id=new.content_id
    and coalesce(r.status,'OPEN')='OPEN'
    and r.user_id is not null;

  if reporter_count >= 3 then
    select c.rights_status::text into previous_rights
    from public.contents c where c.id=new.content_id;

    update public.contents c
    set moderation_status='REPORTED'::public.moderation_status,
        rights_status='REMOVED'::public.rights_status,
        metadata=coalesce(c.metadata,'{}'::jsonb)
          || jsonb_build_object(
              'moderation_quarantined',true,
              'moderation_quarantined_at',now(),
              'moderation_reporter_count',reporter_count,
              'pre_quarantine_rights_status',coalesce(c.metadata->>'pre_quarantine_rights_status',previous_rights)
            ),
        updated_at=now()
    where c.id=new.content_id
      and c.moderation_status::text <> 'REJECTED';
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_capture_report_v1 on public.feedback;
create trigger feedback_capture_report_v1
after insert on public.feedback
for each row execute function public.capture_report_feedback_v1();

drop trigger if exists report_quarantine_content_v1 on public.reports;
create trigger report_quarantine_content_v1
after insert or update of status on public.reports
for each row execute function public.quarantine_content_after_reports_v1();

create or replace function public.get_moderation_queue_v1(p_limit integer default 50)
returns table(
  content_id uuid,
  source_url text,
  creator_id uuid,
  moderation_status text,
  rights_status text,
  report_count bigint,
  reporter_count bigint,
  first_report_at timestamptz,
  last_report_at timestamptz,
  reasons text[]
)
language sql
security definer
set search_path to 'public','pg_catalog'
as $$
  select c.id,
         c.source_url,
         c.creator_id,
         c.moderation_status::text,
         c.rights_status::text,
         count(r.id),
         count(distinct r.user_id),
         min(r.created_at),
         max(r.created_at),
         array_remove(array_agg(distinct coalesce(nullif(r.description,''),r.reason)),null)
  from public.reports r
  join public.contents c on c.id=r.content_id
  where coalesce(r.status,'OPEN')='OPEN'
  group by c.id,c.source_url,c.creator_id,c.moderation_status,c.rights_status
  order by count(distinct r.user_id) desc,max(r.created_at) desc
  limit greatest(1,least(coalesce(p_limit,50),200));
$$;

create or replace function public.resolve_content_report_v1(p_content_id uuid,p_decision text,p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  decision text := upper(trim(coalesce(p_decision,'')));
  previous_rights text;
begin
  if decision not in ('APPROVE','REJECT') then
    raise exception 'decision must be APPROVE or REJECT';
  end if;

  select c.metadata->>'pre_quarantine_rights_status'
    into previous_rights
  from public.contents c where c.id=p_content_id;

  if decision='REJECT' then
    update public.contents
    set moderation_status='REJECTED'::public.moderation_status,
        rights_status='REMOVED'::public.rights_status,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('moderation_resolution','REJECT','moderation_resolution_note',left(p_note,1000),'moderation_resolved_at',now()),
        updated_at=now()
    where id=p_content_id;
  else
    update public.contents
    set moderation_status='APPROVED'::public.moderation_status,
        rights_status=(case when previous_rights in ('AUTHORIZED','REFERENCE_ONLY','PENDING_REVIEW') then previous_rights::public.rights_status else 'REFERENCE_ONLY'::public.rights_status end),
        metadata=(coalesce(metadata,'{}'::jsonb)-'moderation_quarantined')||jsonb_build_object('moderation_resolution','APPROVE','moderation_resolution_note',left(p_note,1000),'moderation_resolved_at',now()),
        updated_at=now()
    where id=p_content_id;
  end if;

  update public.reports
  set status=case when decision='REJECT' then 'RESOLVED_REJECTED' else 'RESOLVED_APPROVED' end,
      resolved_at=now()
  where content_id=p_content_id and coalesce(status,'OPEN')='OPEN';
end;
$$;

revoke all on function public.capture_report_feedback_v1() from public,anon,authenticated;
revoke all on function public.quarantine_content_after_reports_v1() from public,anon,authenticated;
revoke all on function public.get_moderation_queue_v1(integer) from public,anon,authenticated;
revoke all on function public.resolve_content_report_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.get_moderation_queue_v1(integer) to service_role;
grant execute on function public.resolve_content_report_v1(uuid,text,text) to service_role;
