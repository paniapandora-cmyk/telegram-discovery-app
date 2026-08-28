create table if not exists public.telegram_sources (
  id uuid primary key default gen_random_uuid(),

  telegram_peer_id bigint,
  username text,
  title text,

  peer_kind text not null default 'channel'
    check (
      peer_kind in (
        'channel',
        'group',
        'supergroup',
        'user',
        'unknown'
      )
    ),

  enabled boolean not null default true,

  sync_cursor bigint not null default 0,

  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists
telegram_sources_peer_id_uidx
on public.telegram_sources (telegram_peer_id)
where telegram_peer_id is not null;

create unique index if not exists
telegram_sources_username_uidx
on public.telegram_sources (lower(username))
where username is not null;

create index if not exists
telegram_sources_enabled_idx
on public.telegram_sources (enabled, updated_at desc);

create table if not exists public.telegram_sync_runs (
  id uuid primary key default gen_random_uuid(),

  source_id uuid
    references public.telegram_sources(id)
    on delete set null,

  mode text not null default 'incremental'
    check (
      mode in (
        'incremental',
        'backfill',
        'search',
        'manual'
      )
    ),

  status text not null default 'running'
    check (
      status in (
        'running',
        'success',
        'partial',
        'failed'
      )
    ),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,

  last_message_id bigint,
  error_message text,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists
telegram_sync_runs_source_started_idx
on public.telegram_sync_runs (
  source_id,
  started_at desc
);

create index if not exists
telegram_sync_runs_status_idx
on public.telegram_sync_runs (
  status,
  started_at desc
);

alter table public.telegram_sources enable row level security;

alter table public.telegram_sync_runs enable row level security;
