-- Hosted run intake for the Control Room. This stores only synthetic demo
-- accounts and public-safe event summaries. Browser roles have no direct table
-- or RPC access; the allow-listed Edge Function mediates every operation.

create table public.agent_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  account_slug text not null check (account_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  objective text not null check (char_length(objective) between 20 and 500),
  idempotency_key text not null unique
    check (
      char_length(idempotency_key) between 8 and 200
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    ),
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'awaiting_human_approval', 'failed')),
  current_stage text
    check (current_stage in ('researcher', 'designer', 'maker', 'communicator', 'manager')),
  requires_human_approval boolean not null default true
    check (requires_human_approval is true),
  external_actions_permitted integer not null default 0
    check (external_actions_permitted = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  stopped_at timestamptz,
  constraint agent_runs_timestamps_check check (
    updated_at >= created_at
    and (started_at is null or started_at >= created_at)
    and (stopped_at is null or stopped_at >= created_at)
  )
);

create unique index agent_runs_one_open_per_account_idx
  on public.agent_runs (account_id)
  where status in ('queued', 'in_progress', 'awaiting_human_approval');

create index agent_runs_created_idx
  on public.agent_runs (created_at desc);

create table public.agent_run_events (
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null
    check (event_type in ('run_created', 'stage_started', 'stage_completed', 'run_paused_for_approval', 'run_failed')),
  stage text
    check (stage in ('researcher', 'designer', 'maker', 'communicator', 'manager')),
  public_summary text not null check (char_length(public_summary) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (run_id, sequence),
  constraint agent_run_events_type_stage_check check (
    (event_type = 'run_created' and stage is null)
    or (
      event_type in ('stage_started', 'stage_completed', 'run_paused_for_approval', 'run_failed')
      and stage is not null
    )
  )
);

create index agent_run_events_created_idx
  on public.agent_run_events (run_id, created_at);

alter table public.agent_runs enable row level security;
alter table public.agent_run_events enable row level security;

revoke all on table public.agent_runs from public, anon, authenticated;
revoke all on table public.agent_run_events from public, anon, authenticated;
grant select, insert, update on table public.agent_runs to service_role;
grant select, insert on table public.agent_run_events to service_role;

create or replace function public.enforce_agent_run_event_sequence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_sequence integer;
begin
  perform 1 from public.agent_runs where id = new.run_id for update;
  select coalesce(max(event.sequence), 0) + 1 into expected_sequence
  from public.agent_run_events event
  where event.run_id = new.run_id;
  if new.sequence <> expected_sequence then
    raise exception 'agent run event sequence must be %', expected_sequence using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger agent_run_events_enforce_sequence
before insert on public.agent_run_events
for each row execute function public.enforce_agent_run_event_sequence();

revoke all on function public.enforce_agent_run_event_sequence() from public, anon, authenticated;

create or replace function public.create_agent_run(
  p_account_slug text,
  p_objective text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_account public.accounts%rowtype;
  created_run public.agent_runs%rowtype;
  existing_run public.agent_runs%rowtype;
begin
  if p_account_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_account_slug) > 80 then
    raise exception 'invalid account slug' using errcode = '22023';
  end if;
  if char_length(p_objective) < 20 or char_length(p_objective) > 500 then
    raise exception 'invalid objective' using errcode = '22023';
  end if;
  if char_length(p_idempotency_key) < 8
    or char_length(p_idempotency_key) > 200
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  select account.* into selected_account
  from public.accounts account
  join public.demo_generation_runs generation on generation.id = account.generation_run_id
  where account.slug = p_account_slug
    and account.synthetic is true
    and generation.generator_key = 'retentionlab-demo-v1'
    and generation.status = 'ready'
  order by generation.generated_at desc
  limit 1;

  if selected_account.id is null then
    raise exception 'account not found in ready synthetic dataset' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(selected_account.id::text, 0));

  select run.* into existing_run
  from public.agent_runs run
  where run.idempotency_key = p_idempotency_key
     or (
       run.account_id = selected_account.id
       and run.status in ('queued', 'in_progress', 'awaiting_human_approval')
     )
  order by (run.idempotency_key = p_idempotency_key) desc, run.created_at desc
  limit 1;

  if existing_run.id is not null then
    return jsonb_build_object(
      'run', jsonb_build_object(
        'id', existing_run.id,
        'account_id', existing_run.account_id,
        'account_slug', existing_run.account_slug,
        'idempotency_key', existing_run.idempotency_key,
        'objective', existing_run.objective,
        'status', existing_run.status,
        'current_stage', existing_run.current_stage,
        'requires_human_approval', existing_run.requires_human_approval,
        'external_actions_permitted', existing_run.external_actions_permitted,
        'created_at', existing_run.created_at,
        'updated_at', existing_run.updated_at,
        'started_at', existing_run.started_at,
        'stopped_at', existing_run.stopped_at
      ),
      'created', false
    );
  end if;

  insert into public.agent_runs (
    account_id, account_slug, objective, idempotency_key
  ) values (
    selected_account.id, p_account_slug, p_objective, p_idempotency_key
  ) returning * into created_run;

  insert into public.agent_run_events (
    run_id, sequence, event_type, public_summary
  ) values (
    created_run.id, 1, 'run_created',
    'Governed run accepted. No agent or external action has started yet.'
  );

  return jsonb_build_object(
    'run', jsonb_build_object(
      'id', created_run.id,
      'account_id', created_run.account_id,
      'account_slug', created_run.account_slug,
      'idempotency_key', created_run.idempotency_key,
      'objective', created_run.objective,
      'status', created_run.status,
      'current_stage', created_run.current_stage,
      'requires_human_approval', created_run.requires_human_approval,
      'external_actions_permitted', created_run.external_actions_permitted,
      'created_at', created_run.created_at,
      'updated_at', created_run.updated_at,
      'started_at', created_run.started_at,
      'stopped_at', created_run.stopped_at
    ),
    'created', true
  );
end;
$$;

revoke all on function public.create_agent_run(text, text, text) from public, anon, authenticated;
grant execute on function public.create_agent_run(text, text, text) to service_role;

comment on table public.agent_runs is
  'Hosted run intake for fictional RetentionLab accounts; external actions remain hard-disabled.';
comment on table public.agent_run_events is
  'Append-only public-safe event projection for hosted governed runs.';
comment on function public.create_agent_run(text, text, text) is
  'Creates or idempotently returns one open governed run for a ready synthetic account.';
