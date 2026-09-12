create or replace function public.get_related_content_v1(
  p_user_id uuid,
  p_content_id uuid,
  p_limit integer default 8
)
returns table(
  content_id uuid,
  creator_id uuid,
  title text,
  description text,
  text_content text,
  source_url text,
  content_type text,
  media_url text,
  thumbnail_url text,
  published_at timestamptz,
  channel_username text,
  channel_name text,
  channel_avatar_url text,
  channel_url text,
  is_saved boolean,
  related_score double precision,
  related_reason text
)
language sql
stable
security definer
set search_path = public, extensions
as $function$
with target as (
  select
    c.id,
    c.creator_id,
    c.title,
    c.description,
    lower(coalesce(c.title,'') || ' ' || coalesce(c.description,'') || ' ' || coalesce(c.text_content,'')) as body,
    ce.embedding_vector
  from public.contents c
  left join public.content_embeddings ce on ce.content_id = c.id
  where c.id = p_content_id
),
candidates as (
  select
    c.id as content_id,
    c.creator_id,
    c.title,
    c.description,
    c.text_content,
    c.source_url,
    c.content_type::text as content_type,
    c.media_url,
    c.thumbnail_url,
    c.published_at,
    cr.username as channel_username,
    cr.name as channel_name,
    cr.avatar_url as channel_avatar_url,
    cr.source_url as channel_url,
    exists(
      select 1 from public.saves s
      where s.user_id = p_user_id and s.content_id = c.id
    ) as is_saved,
    case
      when t.embedding_vector is not null and ce.embedding_vector is not null
      then greatest(0, 1 - (ce.embedding_vector operator(extensions.<=>) t.embedding_vector))
      else 0
    end::double precision as vector_similarity,
    least(1.0, coalesce((
      select sum(least(coalesce(src.relevance,0.5), coalesce(dst.relevance,0.5)))
      from public.content_topics src
      join public.content_topics dst on dst.topic_id = src.topic_id
      where src.content_id = t.id and dst.content_id = c.id
    ), 0))::double precision as topic_overlap,
    greatest(
      similarity(lower(coalesce(c.title,'')), lower(coalesce(t.title,''))),
      similarity(lower(coalesce(c.description,'')), lower(coalesce(t.description,''))),
      similarity(lower(coalesce(c.text_content,'')), t.body)
    )::double precision as lexical_similarity,
    least(1.0, greatest(0.0, coalesce(cf.normalized_quality, c.quality_score, 0.5)))::double precision as quality,
    public.discovery_freshness_factor(c.published_at)::double precision as freshness,
    least(1.0, greatest(0.0, public.semantic_content_score(p_user_id, c.id)))::double precision as user_affinity,
    case when c.creator_id = t.creator_id then 1.0 else 0.0 end::double precision as same_creator,
    case when exists(
      select 1 from public.impressions i
      where i.user_id = p_user_id and i.content_id = c.id
        and i.created_at > now() - interval '14 days'
    ) then 0.0 else 1.0 end::double precision as unseen_bonus
  from target t
  join public.contents c on c.id <> t.id
  join public.creators cr on cr.id = c.creator_id
  left join public.content_embeddings ce on ce.content_id = c.id
  left join public.discovery_content_features cf on cf.content_id = c.id
  where coalesce(cr.is_active,true) = true
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
    and not exists (
      select 1
      from public.feedback f
      where f.user_id = p_user_id
        and (f.content_id = c.id or (f.creator_id = c.creator_id and f.feedback_type = 'HIDE_CREATOR'))
        and f.feedback_type in ('NOT_INTERESTED','NOT_RELEVANT','HIDE_CREATOR','REPORT')
    )
),
scored as (
  select c.*,
    least(1.0, greatest(0.0,
      0.38*c.vector_similarity +
      0.18*c.topic_overlap +
      0.12*c.lexical_similarity +
      0.10*c.quality +
      0.07*c.freshness +
      0.08*c.user_affinity +
      0.04*c.unseen_bonus +
      0.03*c.same_creator
    ))::double precision as score
  from candidates c
  where c.vector_similarity >= 0.35
     or c.topic_overlap > 0
     or c.lexical_similarity >= 0.08
     or c.same_creator > 0
)
select
  s.content_id,
  s.creator_id,
  s.title,
  s.description,
  s.text_content,
  s.source_url,
  s.content_type,
  s.media_url,
  s.thumbnail_url,
  s.published_at,
  s.channel_username,
  s.channel_name,
  s.channel_avatar_url,
  s.channel_url,
  s.is_saved,
  s.score as related_score,
  case
    when s.vector_similarity >= 0.72 then 'از نظر معنایی نزدیک'
    when s.topic_overlap >= 0.50 then 'موضوع مشابه'
    when s.user_affinity >= 0.35 then 'هماهنگ با علایق تو'
    when s.same_creator > 0 then 'از همین کانال'
    else 'مرتبط با این پست'
  end as related_reason
from scored s
order by s.score desc, s.published_at desc nulls last, s.content_id
limit greatest(1, least(coalesce(p_limit,8), 20));
$function$;

revoke all on function public.get_related_content_v1(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.get_related_content_v1(uuid,uuid,integer) to service_role;
