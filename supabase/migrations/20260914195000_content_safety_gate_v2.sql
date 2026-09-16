create or replace function public.evaluate_content_safety_v1(p_content_id uuid)
returns table(decision text,risk_score double precision,categories text[])
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  body text;
  has_gambling boolean := false;
  has_strong_promo boolean := false;
  has_gambling_destination boolean := false;
  has_known_brand boolean := false;
  result_decision text := 'ALLOW';
  result_score double precision := 0;
  result_categories text[] := '{}'::text[];
  old_rights text;
  old_moderation text;
  safety_was_quarantined boolean := false;
  report_was_quarantined boolean := false;
begin
  select lower(coalesce(c.text_content,c.description,c.title,'')),
         c.rights_status::text,
         c.moderation_status::text,
         coalesce((c.metadata->>'safety_quarantined')::boolean,false),
         coalesce((c.metadata->>'moderation_quarantined')::boolean,false)
    into body,old_rights,old_moderation,safety_was_quarantined,report_was_quarantined
  from public.contents c
  where c.id=p_content_id;

  if not found then return; end if;

  has_gambling := body ~ '(شرط[‌ -]*بندی|شرطبندی|کازینو|casino|sportsbook|betting|polymarket|kalshi|ریتزوبت|ritzo.?bet)';
  has_known_brand := body ~ '(ریتزوبت|ritzo.?bet)';
  has_strong_promo := body ~ '(همین حالا.{0,24}ثبت[‌ -]*نام|ثبت[‌ -]*نام.{0,50}(شرط|کازینو|bet)|شارژ حساب|درگاه کارت|درآمد دلاری|ضرایب بالا|واریز.{0,32}(کریپتو|ریالی|حساب)|تسویه[‌ -]*حساب|تسویه.{0,24}(سریع|آنی))';
  has_gambling_destination := body ~ '(https?://[^[:space:]]*(bet|casino)|@[a-z0-9_]*(bet|casino|support))';

  if has_gambling and has_strong_promo and (has_gambling_destination or has_known_brand) then
    result_decision := 'BLOCK';
    result_score := 0.98;
    result_categories := array['GAMBLING_PROMO'];
  elsif has_gambling then
    result_decision := 'REVIEW';
    result_score := 0.60;
    result_categories := array['GAMBLING_RELATED'];
  end if;

  insert into public.content_safety_assessments(content_id,risk_score,decision,categories,signals,evaluated_at,updated_at)
  values(
    p_content_id,result_score,result_decision,result_categories,
    jsonb_build_object(
      'gambling_term',has_gambling,
      'strong_promo',has_strong_promo,
      'gambling_destination',has_gambling_destination,
      'known_gambling_brand',has_known_brand,
      'ruleset','safety-v2'
    ),now(),now()
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
          'safety_ruleset','safety-v2',
          'safety_quarantined_at',now(),
          'pre_safety_rights_status',coalesce(c.metadata->>'pre_safety_rights_status',old_rights),
          'pre_safety_moderation_status',coalesce(c.metadata->>'pre_safety_moderation_status',old_moderation)
        ),
        updated_at=now()
    where c.id=p_content_id and c.moderation_status::text <> 'REJECTED';
  elsif safety_was_quarantined and not report_was_quarantined then
    update public.contents c
    set moderation_status=(case
          when coalesce(c.metadata->>'pre_safety_moderation_status','PENDING') in ('PENDING','APPROVED','REPORTED')
            then coalesce(c.metadata->>'pre_safety_moderation_status','PENDING')::public.moderation_status
          else 'PENDING'::public.moderation_status end),
        rights_status=(case
          when coalesce(c.metadata->>'pre_safety_rights_status','REFERENCE_ONLY') in ('AUTHORIZED','REFERENCE_ONLY','PENDING_REVIEW')
            then coalesce(c.metadata->>'pre_safety_rights_status','REFERENCE_ONLY')::public.rights_status
          else 'REFERENCE_ONLY'::public.rights_status end),
        metadata=(coalesce(c.metadata,'{}'::jsonb)-'safety_quarantined'-'safety_category'-'safety_quarantined_at')
          || jsonb_build_object('safety_ruleset','safety-v2','safety_released_at',now()),
        updated_at=now()
    where c.id=p_content_id
      and c.moderation_status::text='REPORTED';
  end if;

  return query select result_decision,result_score,result_categories;
end;
$$;

select public.evaluate_content_safety_v1(content_id)
from public.content_safety_assessments;

revoke all on function public.evaluate_content_safety_v1(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_content_safety_v1(uuid) to service_role;
