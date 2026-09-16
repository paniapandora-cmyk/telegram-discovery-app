create or replace function public.guard_content_quarantine_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  if old.rights_status::text='REMOVED'
     and old.moderation_status::text in ('REPORTED','REJECTED')
     and new.moderation_status::text=old.moderation_status::text
     and new.rights_status::text<>'REMOVED' then
    new.rights_status := 'REMOVED'::public.rights_status;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_content_quarantine_v1 on public.contents;
create trigger guard_content_quarantine_v1
before update of rights_status,moderation_status on public.contents
for each row execute function public.guard_content_quarantine_v1();

revoke all on function public.guard_content_quarantine_v1() from public,anon,authenticated;
