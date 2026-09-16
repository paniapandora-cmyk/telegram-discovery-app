alter table public.telegram_sources
  add column if not exists discovery_priority smallint not null default 0;

create index if not exists telegram_sources_discovery_priority_idx
  on public.telegram_sources (enabled, discovery_priority desc, last_synced_at desc nulls last);

update public.telegram_sources
set discovery_priority = case lower(username)
  when 'gizmiztel' then 120
  when 'khabarfouri' then 118
  when 'akhbarefori' then 116
  when 'farsna' then 114
  when 'iranintltv' then 112
  when 'varzesh3' then 110
  when 'bbcpersian' then 108
  when 'radiojavan' then 106
  when 'digiato' then 104
  when 'thezoomit' then 102
  when 'aya_midanstiid1' then 100
  when 'dansstaniha' then 98
  when 'discovery_te' then 80
  when 'tasnimnews' then 20
  else discovery_priority
end
where username is not null;
