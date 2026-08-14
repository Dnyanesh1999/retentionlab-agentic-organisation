-- A lease token is not sufficient after its protected execution window. Reject
-- late completion/failure writes unless the same worker still owns an unexpired
-- lease. This closes the gap before another invocation has a chance to reclaim.

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
    or selected_run.worker_lease_token is distinct from p_lease_token
    or selected_run.worker_lease_expires_at < now() then
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
    or selected_run.worker_lease_token is distinct from p_lease_token
    or selected_run.worker_lease_expires_at < now() then
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
