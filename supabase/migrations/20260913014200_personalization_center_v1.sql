create or replace function public.get_personalization_creators_v1(
  p_user_id uuid,
  p_limit integer default 24
)
returns table(
  creator_id uuid,
  title text,
  username text,
  bio text,
  avatar_url text,
  source_url text,
  verified boolean,
  following boolean,
  followed_at timestamptz,
  follower_count bigint,
  recent_posts bigint,
  topic_affinity double precision,
  quality double precision,
  freshness double precision,
  recommendation_score double precision
)
language sql
stable
security definer
set search_path = public
as $function$
with creator_stats as (
  select cr.id as creator_id, cr.name, cr.username, cr.bio, cr.avatar_url,
         cr.source_url, cr.verified,
         count(c.id) filter (where c.published_at >= now() - interval '30 days')::bigint as recent_posts,
         coalesce(avg(coalesce(cf.normalized_quality,c.quality_score,0.5)) filter (where c.id is not null),0.5)::double precision as quality,
         coalesce(public.discovery_freshness_factor(max(c.published_at)),0)::double precision as freshness
  from public.creators cr
  left join public.contents c on c.creator_id=cr.id
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
  left join public.discovery_content_features cf on cf.content_id=c.id
  where coalesce(cr.is_active,true)=true
  group by cr.id,cr.name,cr.username,cr.bio,cr.avatar_url,cr.source_url,cr.verified
),
affinity as (
  select c.creator_id,
         least(1.0,coalesce(sum(ui.weight*ct.relevance)/nullif(count(distinct c.id),0),0))::double precision as topic_affinity
  from public.user_interests ui
  join public.content_topics ct on ct.topic_id=ui.topic_id
  join public.contents c on c.id=ct.content_id
  where ui.user_id=p_user_id
    and coalesce(c.moderation_status::text,'PENDING') <> 'REJECTED'
    and c.rights_status::text in ('AUTHORIZED','REFERENCE_ONLY')
  group by c.creator_id
),
followers as (
  select creator_id,count(*)::bigint as follower_count from public.follows group by creator_id
),
scored as (
  select cs.*, coalesce(a.topic_affinity,0)::double precision as topic_affinity,
         exists(select 1 from public.follows f where f.user_id=p_user_id and f.creator_id=cs.creator_id) as following,
         (select f.created_at from public.follows f where f.user_id=p_user_id and f.creator_id=cs.creator_id limit 1) as followed_at,
         coalesce(fr.follower_count,0)::bigint as follower_count,
         least(1.0,ln(1+coalesce(fr.follower_count,0))/8.0)::double precision as popularity,
         least(1.0,coalesce(cs.recent_posts,0)::double precision/12.0)::double precision as activity
  from creator_stats cs
  left join affinity a on a.creator_id=cs.creator_id
  left join followers fr on fr.creator_id=cs.creator_id
)
select s.creator_id,coalesce(s.name,s.username,'Telegram Channel'),coalesce(s.username,''),
       coalesce(s.bio,''),s.avatar_url,s.source_url,coalesce(s.verified,false),s.following,
       s.followed_at,s.follower_count,s.recent_posts,s.topic_affinity,s.quality,s.freshness,
       least(1.0,greatest(0.0,
         0.46*s.topic_affinity + 0.18*s.quality + 0.14*s.freshness +
         0.10*s.activity + 0.06*s.popularity + case when s.following then 0.06 else 0 end
       ))::double precision as recommendation_score
from scored s
order by s.following desc,recommendation_score desc,s.recent_posts desc,coalesce(s.name,s.username,'Telegram Channel')
limit greatest(1,least(coalesce(p_limit,24),60));
$function$;

revoke all on function public.get_personalization_creators_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_personalization_creators_v1(uuid,integer) to service_role;

create or replace function public.get_personalized_feed_v9(
  p_user_id uuid,
  p_session_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  content_id uuid, creator_id uuid, title text, description text, source_url text,
  thumbnail_url text, published_at timestamptz, score double precision, reason text,
  source_bucket text, feed_position integer
)
language sql
stable
set search_path = public
as $function$
with params as (
  select greatest(least(p_limit,100),1) as lim,
         least(100,greatest(50,(greatest(least(p_limit,100),1)+greatest(p_offset,0))*5)) as candidate_limit
),
candidates as (
  select f.*,activity.last_seen_at,coalesce(activity.recent_views,0) as recent_views,
         exists(select 1 from public.follows fol where fol.user_id=p_user_id and fol.creator_id=f.creator_id) as followed_creator,
         greatest(0,least(1,
           f.score + case when exists(select 1 from public.follows fol where fol.user_id=p_user_id and fol.creator_id=f.creator_id) then 0.12 else 0 end
           - case
               when activity.last_seen_at >= now()-interval '12 hours' then 0.45
               when activity.last_seen_at >= now()-interval '3 days' then 0.18
               when activity.last_seen_at >= now()-interval '14 days' then 0.07
               else 0
             end
           - least(0.12,coalesce(activity.recent_views,0)*0.025)
         )) as fresh_score
  from params p
  cross join lateral public.get_personalized_feed_v8(p_user_id,p_session_id,p.candidate_limit,0) f
  left join lateral (
    select max(e.created_at) as last_seen_at,
           count(*) filter(where e.created_at >= now()-interval '30 days')::integer as recent_views
    from public.events e
    where e.user_id=p_user_id and e.content_id=f.content_id
      and upper(e.event_type) in ('OPEN','VIEW','LONG_VIEW')
      and e.created_at >= now()-interval '90 days'
  ) activity on true
),
ranked as (
  select c.*,
         row_number() over(order by c.followed_creator desc,(c.last_seen_at is null) desc,c.fresh_score desc,c.published_at desc nulls last,c.content_id)::integer as fresh_position
  from candidates c
)
select r.content_id,r.creator_id,r.title,r.description,r.source_url,r.thumbnail_url,r.published_at,
       r.fresh_score,
       case
         when r.followed_creator and r.last_seen_at is null then r.reason||'_followed'
         when r.followed_creator then r.reason||'_followed_freshened'
         when r.last_seen_at is null then r.reason
         else r.reason||'_freshened'
       end,
       r.source_bucket,r.fresh_position
from ranked r
order by r.fresh_position
limit greatest(least(p_limit,100),1)
offset greatest(p_offset,0);
$function$;
