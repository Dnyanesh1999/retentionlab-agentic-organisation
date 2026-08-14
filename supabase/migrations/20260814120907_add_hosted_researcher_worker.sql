-- Durable, service-only Researcher execution for hosted synthetic runs. The
-- public projection receives bounded lifecycle events; the complete validated
-- artefact remains in the non-exposed private schema.

alter table public.agent_runs
  add column worker_lease_token uuid,
  add column worker_lease_expires_at timestamptz,
  add column worker_attempt integer not null default 0 check (worker_attempt >= 0),
  add constraint agent_runs_worker_lease_pair_check check (
    (worker_lease_token is null) = (worker_lease_expires_at is null)
  );

create table private.agent_run_artifacts (
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  stage text not null check (stage in ('researcher', 'designer', 'maker', 'communicator', 'manager')),
  version integer not null check (version > 0),
  schema_version text not null check (char_length(schema_version) between 3 and 80),
  prompt_version text not null check (char_length(prompt_version) between 3 and 80),
  provider text not null check (provider in ('openrouter')),
  requested_model text not null check (char_length(requested_model) between 1 and 160),
  resolved_model text not null check (char_length(resolved_model) between 1 and 160),
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  artifact jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, stage, version),
  unique (run_id, artifact_hash)
);

alter table private.agent_run_artifacts enable row level security;
revoke all on table private.agent_run_artifacts from public, anon, authenticated, service_role;

create or replace function public.claim_agent_run_researcher(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  lease_token uuid;
  next_sequence integer;
  recovered boolean := false;
begin
  select run.* into selected_run
  from public.agent_runs run
  where run.id = p_run_id
  for update;

  if selected_run.id is null then
    raise exception 'hosted run not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.agent_run_events event
    where event.run_id = p_run_id
      and event.event_type = 'stage_completed'
      and event.stage = 'researcher'
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'researcher_completed');
  end if;

  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'researcher'
    and selected_run.worker_lease_expires_at >= now() then
    return jsonb_build_object('claimed', false, 'reason', 'lease_active');
  end if;

  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'researcher'
    and selected_run.worker_lease_expires_at < now() then
    recovered := true;
  elsif selected_run.status <> 'queued' or selected_run.current_stage is not null then
    return jsonb_build_object('claimed', false, 'reason', 'run_not_claimable');
  end if;

  lease_token := extensions.gen_random_uuid();

  update public.agent_runs
  set status = 'in_progress',
      current_stage = 'researcher',
      worker_lease_token = lease_token,
      worker_lease_expires_at = now() + interval '140 seconds',
      worker_attempt = worker_attempt + 1,
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = p_run_id;

  select coalesce(max(event.sequence), 0) + 1 into next_sequence
  from public.agent_run_events event
  where event.run_id = p_run_id;

  insert into public.agent_run_events (
    run_id, sequence, event_type, stage, public_summary
  ) values (
    p_run_id,
    next_sequence,
    'stage_started',
    'researcher',
    case when recovered
      then 'Researcher safely reclaimed an expired worker lease and restarted from live evidence.'
      else 'Researcher started and is grounding the run in fresh live evidence.'
    end
  );

  return jsonb_build_object(
    'claimed', true,
    'lease_token', lease_token,
    'run_id', selected_run.id,
    'account_slug', selected_run.account_slug,
    'objective', selected_run.objective,
    'initiated_at', selected_run.created_at,
    'attempt', selected_run.worker_attempt + 1
  );
end;
$$;

create or replace function public.complete_agent_run_researcher(
  p_run_id uuid,
  p_lease_token uuid,
  p_artifact jsonb,
  p_artifact_hash text,
  p_requested_model text,
  p_resolved_model text,
  p_public_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  next_sequence integer;
begin
  select run.* into selected_run
  from public.agent_runs run
  where run.id = p_run_id
  for update;

  if selected_run.id is null then
    raise exception 'hosted run not found' using errcode = 'P0002';
  end if;
  if selected_run.status <> 'in_progress'
    or selected_run.current_stage <> 'researcher'
    or selected_run.worker_lease_token is distinct from p_lease_token then
    return jsonb_build_object('completed', false, 'reason', 'stale_or_invalid_lease');
  end if;
  if p_artifact_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid artifact hash' using errcode = '22023';
  end if;
  if char_length(p_public_summary) < 1 or char_length(p_public_summary) > 280 then
    raise exception 'invalid public summary' using errcode = '22023';
  end if;
  if p_artifact ->> 'schema_version' <> 'research-brief.v1'
    or p_artifact ->> 'stage' <> 'researcher'
    or p_artifact ->> 'run_id' <> p_run_id::text
    or p_artifact ->> 'account_slug' <> selected_run.account_slug then
    raise exception 'artifact identity mismatch' using errcode = '22023';
  end if;

  insert into private.agent_run_artifacts (
    run_id, stage, version, schema_version, prompt_version, provider,
    requested_model, resolved_model, artifact_hash, artifact
  ) values (
    p_run_id,
    'researcher',
    1,
    p_artifact ->> 'schema_version',
    p_artifact #>> '{provenance,prompt_version}',
    'openrouter',
    p_requested_model,
    p_resolved_model,
    p_artifact_hash,
    p_artifact
  );

  select coalesce(max(event.sequence), 0) + 1 into next_sequence
  from public.agent_run_events event
  where event.run_id = p_run_id;

  insert into public.agent_run_events (
    run_id, sequence, event_type, stage, public_summary
  ) values (
    p_run_id, next_sequence, 'stage_completed', 'researcher', p_public_summary
  );

  update public.agent_runs
  set status = 'queued',
      current_stage = null,
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;

  return jsonb_build_object('completed', true, 'next_stage', 'designer');
end;
$$;

create or replace function public.fail_agent_run_stage(
  p_run_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  next_sequence integer;
begin
  if p_stage not in ('researcher', 'designer', 'maker', 'communicator', 'manager') then
    raise exception 'invalid stage' using errcode = '22023';
  end if;
  if char_length(p_reason) < 1 or char_length(p_reason) > 500 then
    raise exception 'invalid failure reason' using errcode = '22023';
  end if;

  select run.* into selected_run
  from public.agent_runs run
  where run.id = p_run_id
  for update;

  if selected_run.id is null then
    raise exception 'hosted run not found' using errcode = 'P0002';
  end if;
  if selected_run.status <> 'in_progress'
    or selected_run.current_stage <> p_stage
    or selected_run.worker_lease_token is distinct from p_lease_token then
    return jsonb_build_object('recorded', false, 'reason', 'stale_or_invalid_lease');
  end if;

  select coalesce(max(event.sequence), 0) + 1 into next_sequence
  from public.agent_run_events event
  where event.run_id = p_run_id;

  insert into public.agent_run_events (
    run_id, sequence, event_type, stage, public_summary
  ) values (
    p_run_id, next_sequence, 'run_failed', p_stage, p_reason
  );

  update public.agent_runs
  set status = 'failed',
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now(),
      stopped_at = now()
  where id = p_run_id;

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.claim_agent_run_researcher(uuid) from public, anon, authenticated;
revoke all on function public.complete_agent_run_researcher(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_agent_run_stage(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.claim_agent_run_researcher(uuid) to service_role;
grant execute on function public.complete_agent_run_researcher(uuid, uuid, jsonb, text, text, text, text) to service_role;
grant execute on function public.fail_agent_run_stage(uuid, uuid, text, text) to service_role;

comment on table private.agent_run_artifacts is
  'Validated hosted agent artefacts; never exposed to browser roles.';
comment on function public.claim_agent_run_researcher(uuid) is
  'Service-only lease claim for the hosted Researcher stage.';
comment on function public.complete_agent_run_researcher(uuid, uuid, jsonb, text, text, text, text) is
  'Atomically persists a validated ResearchBrief and queues the Designer handoff.';
