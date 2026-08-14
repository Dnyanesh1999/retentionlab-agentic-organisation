-- Hosted Designer inherits exactly one sealed private ResearchBrief. The
-- browser receives lifecycle events only; neither predecessor nor design
-- artefact is exposed through the Data API.

create or replace function public.claim_agent_run_designer(p_run_id uuid)
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
      and event.stage = 'designer'
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'designer_completed');
  end if;

  select artifact.* into predecessor
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id
    and artifact.stage = 'researcher'
    and artifact.version = 1;

  if predecessor.run_id is null or not exists (
    select 1 from public.agent_run_events event
    where event.run_id = p_run_id
      and event.event_type = 'stage_completed'
      and event.stage = 'researcher'
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'researcher_not_sealed');
  end if;

  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'designer'
    and selected_run.worker_lease_expires_at >= now() then
    return jsonb_build_object('claimed', false, 'reason', 'lease_active');
  end if;
  if selected_run.status = 'in_progress'
    and selected_run.current_stage = 'designer'
    and selected_run.worker_lease_expires_at < now() then
    recovered := true;
  elsif selected_run.status <> 'queued' or selected_run.current_stage is not null then
    return jsonb_build_object('claimed', false, 'reason', 'run_not_claimable');
  end if;

  lease_token := extensions.gen_random_uuid();

  update public.agent_runs
  set status = 'in_progress',
      current_stage = 'designer',
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
    'designer',
    case when recovered
      then 'Designer safely reclaimed an expired worker lease and restarted from the sealed ResearchBrief.'
      else 'Designer started and is transforming the sealed ResearchBrief into a governed recovery design.'
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

create or replace function public.complete_agent_run_designer(
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
  predecessor private.agent_run_artifacts%rowtype;
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
    or selected_run.current_stage <> 'designer'
    or selected_run.worker_lease_token is distinct from p_lease_token
    or selected_run.worker_lease_expires_at < now() then
    return jsonb_build_object('completed', false, 'reason', 'stale_or_invalid_lease');
  end if;

  select artifact.* into predecessor
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id
    and artifact.stage = 'researcher'
    and artifact.version = 1;

  if predecessor.run_id is null then
    raise exception 'researcher predecessor missing' using errcode = '22023';
  end if;
  if p_artifact_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid artifact hash' using errcode = '22023';
  end if;
  if char_length(p_public_summary) < 1 or char_length(p_public_summary) > 280 then
    raise exception 'invalid public summary' using errcode = '22023';
  end if;
  if p_artifact ->> 'schema_version' <> 'recovery-design.v1'
    or p_artifact ->> 'stage' <> 'designer'
    or p_artifact ->> 'run_id' <> p_run_id::text
    or p_artifact ->> 'account_slug' <> selected_run.account_slug
    or p_artifact #>> '{source,research_artifact_sha256}' <> predecessor.artifact_hash then
    raise exception 'artifact identity or predecessor lineage mismatch' using errcode = '22023';
  end if;

  insert into private.agent_run_artifacts (
    run_id, stage, version, schema_version, prompt_version, provider,
    requested_model, resolved_model, artifact_hash, artifact
  ) values (
    p_run_id,
    'designer',
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
    p_run_id, next_sequence, 'stage_completed', 'designer', p_public_summary
  );

  update public.agent_runs
  set status = 'queued',
      current_stage = null,
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now()
  where id = p_run_id;

  return jsonb_build_object('completed', true, 'next_stage', 'maker');
end;
$$;

revoke all on function public.claim_agent_run_designer(uuid) from public, anon, authenticated;
revoke all on function public.complete_agent_run_designer(uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;

grant execute on function public.claim_agent_run_designer(uuid) to service_role;
grant execute on function public.complete_agent_run_designer(uuid, uuid, jsonb, text, text, text, text) to service_role;

comment on function public.claim_agent_run_designer(uuid) is
  'Service-only Designer lease that returns exactly one sealed private ResearchBrief.';
comment on function public.complete_agent_run_designer(uuid, uuid, jsonb, text, text, text, text) is
  'Atomically persists a validated Recovery Design Specification and queues Maker.';
