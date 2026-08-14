-- Complete the hosted organisation with service-only leases for Maker,
-- Communicator and Manager. Full artefacts remain in the private schema;
-- browser roles receive bounded lifecycle events only.

create or replace function private.claim_agent_run_successor(
  p_run_id uuid,
  p_stage text,
  p_predecessor_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  predecessor private.agent_run_artifacts%rowtype;
  lease_token uuid;
  next_sequence integer;
  recovered boolean := false;
begin
  if (p_stage, p_predecessor_stage) not in (('maker', 'designer'), ('communicator', 'maker')) then
    raise exception 'invalid hosted stage transition' using errcode = '22023';
  end if;

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
      and event.stage = p_stage
  ) then
    return jsonb_build_object('claimed', false, 'reason', p_stage || '_completed');
  end if;

  select artifact.* into predecessor
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id
    and artifact.stage = p_predecessor_stage
    and artifact.version = 1;

  if predecessor.run_id is null or not exists (
    select 1 from public.agent_run_events event
    where event.run_id = p_run_id
      and event.event_type = 'stage_completed'
      and event.stage = p_predecessor_stage
  ) then
    return jsonb_build_object('claimed', false, 'reason', p_predecessor_stage || '_not_sealed');
  end if;

  if selected_run.status = 'in_progress'
    and selected_run.current_stage = p_stage
    and selected_run.worker_lease_expires_at >= now() then
    return jsonb_build_object('claimed', false, 'reason', 'lease_active');
  end if;
  if selected_run.status = 'in_progress'
    and selected_run.current_stage = p_stage
    and selected_run.worker_lease_expires_at < now() then
    recovered := true;
  elsif selected_run.status <> 'queued' or selected_run.current_stage is not null then
    return jsonb_build_object('claimed', false, 'reason', 'run_not_claimable');
  end if;

  lease_token := extensions.gen_random_uuid();
  update public.agent_runs
  set status = 'in_progress',
      current_stage = p_stage,
      worker_lease_token = lease_token,
      worker_lease_expires_at = now() + interval '140 seconds',
      worker_attempt = worker_attempt + 1,
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
    p_stage,
    case when recovered
      then initcap(p_stage) || ' safely reclaimed an expired worker lease and restarted from its sealed predecessor.'
      else initcap(p_stage) || ' started from the sealed ' || initcap(p_predecessor_stage) || ' artefact.'
    end
  );

  return jsonb_build_object(
    'claimed', true,
    'lease_token', lease_token,
    'run_id', selected_run.id,
    'account_slug', selected_run.account_slug,
    'attempt', selected_run.worker_attempt + 1,
    'predecessor_artifact', predecessor.artifact,
    'predecessor_hash', predecessor.artifact_hash
  );
end;
$$;

create or replace function private.complete_agent_run_successor(
  p_run_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_predecessor_stage text,
  p_expected_schema text,
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
  predecessor private.agent_run_artifacts%rowtype;
  next_sequence integer;
  lineage_hash text;
  next_stage text;
begin
  if (p_stage, p_predecessor_stage, p_expected_schema) = ('maker', 'designer', 'recovery-room-artifact.v1') then
    lineage_hash := p_artifact #>> '{source,design_artifact_sha256}';
    next_stage := 'communicator';
  elsif (p_stage, p_predecessor_stage, p_expected_schema) = ('communicator', 'maker', 'communication-plan.v1') then
    lineage_hash := p_artifact #>> '{source,maker_artifact_sha256}';
    next_stage := 'manager';
  else
    raise exception 'invalid hosted stage transition' using errcode = '22023';
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
    or selected_run.worker_lease_token is distinct from p_lease_token
    or selected_run.worker_lease_expires_at < now() then
    return jsonb_build_object('completed', false, 'reason', 'stale_or_invalid_lease');
  end if;

  select artifact.* into predecessor
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id
    and artifact.stage = p_predecessor_stage
    and artifact.version = 1;

  if predecessor.run_id is null then
    raise exception 'hosted predecessor missing' using errcode = '22023';
  end if;
  if p_artifact_hash !~ '^[0-9a-f]{64}$'
    or char_length(p_public_summary) not between 1 and 280 then
    raise exception 'invalid hosted completion envelope' using errcode = '22023';
  end if;
  if p_artifact ->> 'schema_version' <> p_expected_schema
    or p_artifact ->> 'stage' <> p_stage
    or p_artifact ->> 'run_id' <> p_run_id::text
    or p_artifact ->> 'account_slug' <> selected_run.account_slug
    or lineage_hash <> predecessor.artifact_hash then
    raise exception 'artifact identity or predecessor lineage mismatch' using errcode = '22023';
  end if;

  insert into private.agent_run_artifacts (
    run_id, stage, version, schema_version, prompt_version, provider,
    requested_model, resolved_model, artifact_hash, artifact
  ) values (
    p_run_id,
    p_stage,
    1,
    p_expected_schema,
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
    p_run_id, next_sequence, 'stage_completed', p_stage, p_public_summary
  );

  update public.agent_runs
  set status = 'queued',
      current_stage = null,
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;

  return jsonb_build_object('completed', true, 'next_stage', next_stage);
end;
$$;

create or replace function public.claim_agent_run_maker(p_run_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select private.claim_agent_run_successor(p_run_id, 'maker', 'designer') $$;

create or replace function public.complete_agent_run_maker(
  p_run_id uuid, p_lease_token uuid, p_artifact jsonb, p_artifact_hash text,
  p_requested_model text, p_resolved_model text, p_public_summary text
)
returns jsonb language sql security definer set search_path = ''
as $$
  select private.complete_agent_run_successor(
    p_run_id, p_lease_token, 'maker', 'designer', 'recovery-room-artifact.v1',
    p_artifact, p_artifact_hash, p_requested_model, p_resolved_model, p_public_summary
  )
$$;

create or replace function public.claim_agent_run_communicator(p_run_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select private.claim_agent_run_successor(p_run_id, 'communicator', 'maker') $$;

create or replace function public.complete_agent_run_communicator(
  p_run_id uuid, p_lease_token uuid, p_artifact jsonb, p_artifact_hash text,
  p_requested_model text, p_resolved_model text, p_public_summary text
)
returns jsonb language sql security definer set search_path = ''
as $$
  select private.complete_agent_run_successor(
    p_run_id, p_lease_token, 'communicator', 'maker', 'communication-plan.v1',
    p_artifact, p_artifact_hash, p_requested_model, p_resolved_model, p_public_summary
  )
$$;

revoke all on function private.claim_agent_run_successor(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.complete_agent_run_successor(uuid, uuid, text, text, text, jsonb, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_agent_run_maker(uuid) from public, anon, authenticated;
revoke all on function public.complete_agent_run_maker(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_agent_run_communicator(uuid) from public, anon, authenticated;
revoke all on function public.complete_agent_run_communicator(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;

grant execute on function public.claim_agent_run_maker(uuid) to service_role;
grant execute on function public.complete_agent_run_maker(uuid, uuid, jsonb, text, text, text, text) to service_role;
grant execute on function public.claim_agent_run_communicator(uuid) to service_role;
grant execute on function public.complete_agent_run_communicator(uuid, uuid, jsonb, text, text, text, text) to service_role;

comment on function public.claim_agent_run_maker(uuid) is
  'Service-only Maker lease returning exactly one sealed private Designer artefact.';
comment on function public.complete_agent_run_maker(uuid, uuid, jsonb, text, text, text, text) is
  'Atomically persists a validated Recovery Room artefact and queues Communicator.';
comment on function public.claim_agent_run_communicator(uuid) is
  'Service-only Communicator lease returning exactly one sealed private Maker artefact.';
comment on function public.complete_agent_run_communicator(uuid, uuid, jsonb, text, text, text, text) is
  'Atomically persists a validated Communication Plan and queues Manager.';

create or replace function public.claim_agent_run_manager(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  research private.agent_run_artifacts%rowtype;
  design private.agent_run_artifacts%rowtype;
  maker private.agent_run_artifacts%rowtype;
  communicator private.agent_run_artifacts%rowtype;
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
      and event.stage = 'manager'
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'manager_completed');
  end if;

  select artifact.* into research from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'researcher' and artifact.version = 1;
  select artifact.* into design from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'designer' and artifact.version = 1;
  select artifact.* into maker from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'maker' and artifact.version = 1;
  select artifact.* into communicator from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'communicator' and artifact.version = 1;

  if research.run_id is null or design.run_id is null or maker.run_id is null or communicator.run_id is null
    or (select count(*) from public.agent_run_events event
        where event.run_id = p_run_id
          and event.event_type = 'stage_completed'
          and event.stage in ('researcher', 'designer', 'maker', 'communicator')) <> 4 then
    return jsonb_build_object('claimed', false, 'reason', 'predecessor_chain_not_sealed');
  end if;

  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'manager'
    and selected_run.worker_lease_expires_at >= now() then
    return jsonb_build_object('claimed', false, 'reason', 'lease_active');
  end if;
  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'manager'
    and selected_run.worker_lease_expires_at < now() then
    recovered := true;
  elsif selected_run.status <> 'queued' or selected_run.current_stage is not null then
    return jsonb_build_object('claimed', false, 'reason', 'run_not_claimable');
  end if;

  lease_token := extensions.gen_random_uuid();
  update public.agent_runs
  set status = 'in_progress',
      current_stage = 'manager',
      worker_lease_token = lease_token,
      worker_lease_expires_at = now() + interval '140 seconds',
      worker_attempt = worker_attempt + 1,
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
    'manager',
    case when recovered
      then 'Manager safely reclaimed an expired worker lease and restarted the sealed-chain review.'
      else 'Manager started the final governance review across all four sealed predecessor artefacts.'
    end
  );

  return jsonb_build_object(
    'claimed', true,
    'lease_token', lease_token,
    'run_id', selected_run.id,
    'account_slug', selected_run.account_slug,
    'attempt', selected_run.worker_attempt + 1,
    'research_artifact', research.artifact,
    'research_hash', research.artifact_hash,
    'design_artifact', design.artifact,
    'design_hash', design.artifact_hash,
    'maker_artifact', maker.artifact,
    'maker_hash', maker.artifact_hash,
    'communicator_artifact', communicator.artifact,
    'communicator_hash', communicator.artifact_hash
  );
end;
$$;

create or replace function public.complete_agent_run_manager(
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
  research private.agent_run_artifacts%rowtype;
  design private.agent_run_artifacts%rowtype;
  maker private.agent_run_artifacts%rowtype;
  communicator private.agent_run_artifacts%rowtype;
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
    or selected_run.current_stage <> 'manager'
    or selected_run.worker_lease_token is distinct from p_lease_token
    or selected_run.worker_lease_expires_at < now() then
    return jsonb_build_object('completed', false, 'reason', 'stale_or_invalid_lease');
  end if;

  select artifact.* into research from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'researcher' and artifact.version = 1;
  select artifact.* into design from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'designer' and artifact.version = 1;
  select artifact.* into maker from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'maker' and artifact.version = 1;
  select artifact.* into communicator from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'communicator' and artifact.version = 1;

  if research.run_id is null or design.run_id is null or maker.run_id is null or communicator.run_id is null then
    raise exception 'manager predecessor chain missing' using errcode = '22023';
  end if;
  if p_artifact_hash !~ '^[0-9a-f]{64}$'
    or char_length(p_public_summary) not between 1 and 280 then
    raise exception 'invalid manager completion envelope' using errcode = '22023';
  end if;
  if p_artifact ->> 'schema_version' <> 'manager-operational-decision.v1'
    or p_artifact ->> 'stage' <> 'manager'
    or p_artifact ->> 'run_id' <> p_run_id::text
    or p_artifact ->> 'account_slug' <> selected_run.account_slug
    or p_artifact ->> 'decision' <> 'approve'
    or p_artifact #>> '{lineage,research_brief_sha256}' <> research.artifact_hash
    or p_artifact #>> '{lineage,design_specification_sha256}' <> design.artifact_hash
    or p_artifact #>> '{lineage,recovery_room_artifact_sha256}' <> maker.artifact_hash
    or p_artifact #>> '{lineage,communication_plan_sha256}' <> communicator.artifact_hash
    or p_artifact #>> '{lineage,chain_verified}' <> 'true'
    or p_artifact #>> '{governance,human_approval_required}' <> 'true'
    or p_artifact #>> '{governance,autonomous_external_actions}' <> 'false'
    or p_artifact #>> '{governance,permitted_next_action}' <> 'await_human_approval' then
    raise exception 'manager identity, lineage or governance mismatch' using errcode = '22023';
  end if;

  insert into private.agent_run_artifacts (
    run_id, stage, version, schema_version, prompt_version, provider,
    requested_model, resolved_model, artifact_hash, artifact
  ) values (
    p_run_id,
    'manager',
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
    p_run_id, next_sequence, 'stage_completed', 'manager', p_public_summary
  );

  insert into public.agent_run_events (
    run_id, sequence, event_type, stage, public_summary
  ) values (
    p_run_id,
    next_sequence + 1,
    'run_paused_for_approval',
    'manager',
    'The five-stage chain is sealed. Human approval remains mandatory and no customer action has been sent.'
  );

  update public.agent_runs
  set status = 'awaiting_human_approval',
      current_stage = 'manager',
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;

  return jsonb_build_object('completed', true, 'next_stage', null, 'status', 'awaiting_human_approval');
end;
$$;

revoke all on function public.claim_agent_run_manager(uuid) from public, anon, authenticated;
revoke all on function public.complete_agent_run_manager(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_agent_run_manager(uuid) to service_role;
grant execute on function public.complete_agent_run_manager(uuid, uuid, jsonb, text, text, text, text) to service_role;

comment on function public.claim_agent_run_manager(uuid) is
  'Service-only Manager lease returning the complete sealed private predecessor chain.';
comment on function public.complete_agent_run_manager(uuid, uuid, jsonb, text, text, text, text) is
  'Persists the final governed decision and pauses the run at the mandatory human boundary.';
