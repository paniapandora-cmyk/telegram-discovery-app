create index if not exists idx_creator_claims_user_id on public.creator_claims(user_id);
create index if not exists idx_creator_daily_stats_content_id on public.creator_daily_stats(content_id);
create index if not exists idx_creator_daily_stats_creator_channel_id on public.creator_daily_stats(creator_channel_id);
create index if not exists idx_creator_events_creator_user_id on public.creator_events(creator_user_id);
create index if not exists idx_creator_events_viewer_user_id on public.creator_events(viewer_user_id);
create index if not exists idx_creator_tracking_links_creator_id on public.creator_tracking_links(creator_id);
create index if not exists idx_creator_tracking_links_creator_user_id on public.creator_tracking_links(creator_user_id);
create index if not exists idx_creator_transactions_creator_channel_id on public.creator_transactions(creator_channel_id);
create index if not exists idx_ingestion_events_content_id on public.ingestion_events(content_id);
create index if not exists idx_ingestion_events_creator_id on public.ingestion_events(creator_id);
create index if not exists idx_reports_creator_id on public.reports(creator_id);
create index if not exists idx_reports_user_id on public.reports(user_id);

drop index if exists public.idx_events_user_created;
drop index if exists public.idx_events_user_created_at;
drop index if exists public.idx_events_user_time;
drop index if exists public.idx_events_content_created;
drop index if exists public.idx_events_content_created_at;
drop index if exists public.idx_events_content_time;
drop index if exists public.events_user_content_created_idx;
drop index if exists public.idx_training_events_user;
drop index if exists public.idx_training_user_created_at;
drop index if exists public.idx_feedback_user;
drop index if exists public.idx_feedback_user_created;
drop index if exists public.idx_feedback_user_content_created_at;
drop index if exists public.idx_impressions_user;
drop index if exists public.idx_impressions_user_created_at;
drop index if exists public.idx_impressions_user_content;
drop index if exists public.content_embeddings_vector_idx;
drop index if exists public.idx_contents_published;
drop index if exists public.creators_username_idx;
drop index if exists public.idx_discovery_embedding_jobs_status;
drop index if exists public.ux_user_interests;

create or replace function public.cleanup_discovery_operational_history_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_stale integer:=0;
  v_success integer:=0;
  v_other integer:=0;
begin
  update public.telegram_sync_runs
     set status='failed',
         completed_at=coalesce(completed_at,now()),
         error_message=coalesce(nullif(error_message,''),'stale running sync recovered by retention job')
   where status='running'
     and started_at < now()-interval '30 minutes';
  get diagnostics v_stale = row_count;

  delete from public.telegram_sync_runs
   where status='success'
     and started_at < now()-interval '21 days';
  get diagnostics v_success = row_count;

  delete from public.telegram_sync_runs
   where status in ('partial','failed')
     and started_at < now()-interval '45 days';
  get diagnostics v_other = row_count;

  delete from public.content_safety_assessments
   where evaluated_at < now()-interval '90 days'
     and decision='ALLOW';

  return jsonb_build_object('stale_runs_recovered',v_stale,'success_runs_deleted',v_success,'error_runs_deleted',v_other);
end;
$$;

revoke all on function public.cleanup_discovery_operational_history_v1() from public,anon,authenticated;
grant execute on function public.cleanup_discovery_operational_history_v1() to service_role;

select cron.unschedule(jobid) from cron.job where jobname='discovery-operational-retention-v1';
select cron.schedule('discovery-operational-retention-v1','17 4 * * *','select public.cleanup_discovery_operational_history_v1();');
select public.cleanup_discovery_operational_history_v1();
