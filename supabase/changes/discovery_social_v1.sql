-- App-owned interactions. Telegram identity is verified by the Edge Function;
-- these tables/RPCs are never callable with browser anon/authenticated credentials.
create table public.discovery_likes (
 content_id uuid references public.contents(id) on delete cascade,
 user_id uuid references public.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(content_id,user_id)
);
create index discovery_likes_user_idx on public.discovery_likes(user_id);
create table public.discovery_comments (
 id uuid primary key default gen_random_uuid(),
 content_id uuid not null references public.contents(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 parent_id uuid references public.discovery_comments(id),
 body text not null check(char_length(body) between 1 and 1500),
 request_id uuid not null,
 created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(user_id,request_id)
);
create index discovery_comments_post_idx on public.discovery_comments(content_id,created_at desc,id desc);
create index discovery_comments_user_idx on public.discovery_comments(user_id,created_at desc);
create index discovery_comments_parent_idx on public.discovery_comments(parent_id);
create table public.discovery_comment_reports (
 comment_id uuid references public.discovery_comments(id) on delete cascade,
 user_id uuid references public.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(comment_id,user_id)
);
create index discovery_comment_reports_user_idx on public.discovery_comment_reports(user_id);
alter table public.discovery_likes enable row level security;
alter table public.discovery_comments enable row level security;
alter table public.discovery_comment_reports enable row level security;
revoke all on public.discovery_likes,public.discovery_comments,public.discovery_comment_reports from public,anon,authenticated;
grant all on public.discovery_likes,public.discovery_comments,public.discovery_comment_reports to service_role;

create function public.discovery_social_stats_v1(p_user_id uuid,p_ids uuid[]) returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('content_id',c.id,
 'likes',(select count(*) from discovery_likes l where l.content_id=c.id),
 'liked',exists(select 1 from discovery_likes l where l.content_id=c.id and l.user_id=p_user_id),
 'comments',(select count(*) from discovery_comments m where m.content_id=c.id and m.deleted_at is null))), '[]'::jsonb)
 from contents c where c.id=any(p_ids);
$$;
create function public.discovery_comment_write_v1(p_user_id uuid,p_content_id uuid,p_body text,p_request_id uuid,p_parent_id uuid default null) returns uuid
language plpgsql security invoker set search_path=public as $$
declare existing uuid; result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,71));
 select id into existing from discovery_comments where user_id=p_user_id and request_id=p_request_id and content_id=p_content_id;
 if existing is not null then return existing; end if;
 if p_request_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 1500 then raise exception 'invalid_comment'; end if;
 if exists(select 1 from discovery_comments where user_id=p_user_id and created_at>now()-interval '10 seconds') or
 (select count(*) from discovery_comments where user_id=p_user_id and created_at>now()-interval '1 hour')>=30 then raise exception 'comment_rate_limit'; end if;
 if p_parent_id is not null and not exists(select 1 from discovery_comments where id=p_parent_id and content_id=p_content_id and deleted_at is null) then raise exception 'invalid_parent'; end if;
 insert into discovery_comments(user_id,content_id,body,request_id,parent_id) values(p_user_id,p_content_id,btrim(p_body),p_request_id,p_parent_id) returning id into result;
 return result;
end $$;
create function public.discovery_comments_page_v1(p_user_id uuid,p_content_id uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'created_at',m.created_at,'mine',m.user_id=p_user_id,
 'author',coalesce(nullif(left(u.display_name,80),''),'کاربر دیسکاوری'),
 'parent',case when p.id is null then null else jsonb_build_object('author',coalesce(left(pu.display_name,80),'کاربر دیسکاوری'),'body',case when p.deleted_at is null then left(p.body,140) else 'نظر حذف شده' end) end,
 'reported',exists(select 1 from discovery_comment_reports r where r.comment_id=m.id and r.user_id=p_user_id)) order by m.created_at desc,m.id desc),'[]'::jsonb)
 from (select * from discovery_comments where content_id=p_content_id and deleted_at is null
 and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit 21) m
 join users u on u.id=m.user_id left join discovery_comments p on p.id=m.parent_id left join users pu on pu.id=p.user_id;
$$;
revoke all on function public.discovery_social_stats_v1(uuid,uuid[]),public.discovery_comment_write_v1(uuid,uuid,text,uuid,uuid),public.discovery_comments_page_v1(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.discovery_social_stats_v1(uuid,uuid[]),public.discovery_comment_write_v1(uuid,uuid,text,uuid,uuid),public.discovery_comments_page_v1(uuid,uuid,timestamptz,uuid) to service_role;
