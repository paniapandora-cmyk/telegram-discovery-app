create table if not exists public.content_safety_assessments (
  content_id uuid primary key references public.contents(id) on delete cascade,
  risk_score double precision not null default 0,
  decision text not null default 'ALLOW' check (decision in ('ALLOW','REVIEW','BLOCK')),
  categories text[] not null default '{}'::text[],
  signals jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_safety_assessments enable row level security;
revoke all on table public.content_safety_assessments from public,anon,authenticated;
grant all on table public.content_safety_assessments to service_role;

create index if not exists content_safety_decision_updated_idx
  on public.content_safety_assessments(decision,updated_at desc);

create or replace function public.evaluate_content_safety_v1(p_content_id uuid)
returns table(decision text,risk_score double precision,categories text[])
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  body text;
  has_gambling boolean := false;
  has_promo boolean := false;
  has_contact boolean := false;
  result_decision text := 'ALLOW';
  result_score double precision := 0;
  result_categories text[] := '{}'::text[];
  old_rights text;
begin
  select lower(coalesce(c.text_content,c.description,c.title,'')),c.rights_status::text
    into body,old_rights
  from public.contents c
  where c.id=p_content_id;

  if not found then
    return;
  end if;

  has_gambling := body ~ '(شرط[‌ -]*بندی|شرطبندی|کازینو|casino|sportsbook|betting|ریتزوبت|ritzo.?bet)';
  has_promo := body ~ '(ثبت[‌ -]*نام|واریز|تسویه|شارژ حساب|پشتیبان|اپلیکیشن|درآمد دلاری|کد هدیه|ضرایب بالا|همین حالا)';
  has_contact := body ~ '(https?://|@[a-z0-9_]{4,})';

  if has_gambling and has_promo and has_contact then
    result_decision := 'BLOCK';
    result_score := 0.98;
    result_categories := array['GAMBLING_PROMO'];
  elsif has_gambling and (has_promo or has_contact) then
    result_decision := 'REVIEW';
    result_score := 0.72;
    result_categories := array['GAMBLING_RELATED'];
  end if;

  insert into public.content_safety_assessments(content_id,risk_score,decision,categories,signals,evaluated_at,updated_at)
  values(
    p_content_id,result_score,result_decision,result_categories,
    jsonb_build_object('gambling_term',has_gambling,'promo_term',has_promo,'contact_or_link',has_contact,'ruleset','safety-v1'),
    now(),now()
  )
  on conflict(content_id) do update set
    risk_score=excluded.risk_score,
    decision=excluded.decision,
    categories=excluded.categories,
    signals=excluded.signals,
    evaluated_at=now(),
    updated_at=now();

  if result_decision='BLOCK' then
    update public.contents c
    set moderation_status='REPORTED'::public.moderation_status,
        rights_status='REMOVED'::public.rights_status,
        metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
          'safety_quarantined',true,
          'safety_category','GAMBLING_PROMO',
          'safety_ruleset','safety-v1',
          'safety_quarantined_at',now(),
          'pre_safety_rights_status',coalesce(c.metadata->>'pre_safety_rights_status',old_rights)
        ),
        updated_at=now()
    where c.id=p_content_id and c.moderation_status::text <> 'REJECTED';
  end if;

  return query select result_decision,result_score,result_categories;
end;
$$;

create or replace function public.evaluate_content_safety_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
begin
  if new.source_type='TELEGRAM' and nullif(btrim(coalesce(new.text_content,'')),'') is not null then
    perform public.evaluate_content_safety_v1(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists evaluate_content_safety_v1 on public.contents;
create trigger evaluate_content_safety_v1
after insert or update of text_content on public.contents
for each row
when (new.source_type='TELEGRAM')
execute function public.evaluate_content_safety_trigger_v1();

with candidates as (
  select c.id
  from public.contents c
  where c.source_type='TELEGRAM'
    and lower(coalesce(c.text_content,c.description,c.title,'')) ~ '(شرط[‌ -]*بندی|شرطبندی|کازینو|casino|sportsbook|betting|ریتزوبت|ritzo.?bet)'
    and lower(coalesce(c.text_content,c.description,c.title,'')) ~ '(ثبت[‌ -]*نام|واریز|تسویه|شارژ حساب|پشتیبان|اپلیکیشن|درآمد دلاری|کد هدیه|ضرایب بالا|همین حالا)'
    and lower(coalesce(c.text_content,c.description,c.title,'')) ~ '(https?://|@[a-z0-9_]{4,})'
)
select public.evaluate_content_safety_v1(id) from candidates;

revoke all on function public.evaluate_content_safety_v1(uuid) from public,anon,authenticated;
revoke all on function public.evaluate_content_safety_trigger_v1() from public,anon,authenticated;
grant execute on function public.evaluate_content_safety_v1(uuid) to service_role;
