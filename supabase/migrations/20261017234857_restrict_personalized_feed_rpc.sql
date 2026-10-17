-- Identity is validated by discovery-api-v33; clients must not choose another user's UUID.
revoke execute on function public.get_personalized_feed_v9(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.get_personalized_feed_v9(uuid,uuid,integer,integer) to service_role;
