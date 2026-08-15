-- Fix an ambiguous identifier in public.record_agent_run_decision.
--
-- The original declared a record variable named `operator` and then used `operator` as the table
-- alias in the same statement, so `operator.auth_user_id` was ambiguous and Postgres raised 42702 at
-- runtime. The function therefore failed with an error instead of returning its intended
-- `operator_not_authorised` refusal, which surfaced at the gateway as a 502 rather than a 403.
--
-- Found by a live adversarial probe against the deployed function on 15 August 2026: an authenticated
-- but non-allow-listed operator received 502 from `decide_run` while the equivalent check in
-- `get_agent_run_decision_context` correctly returned 403. That function uses an `exists` test with no
-- record variable, so this replacement adopts the same shape.
--
-- Forward-only: this replaces the function body. It changes no table, constraint, index, grant or
-- recorded event, and every governance check is preserved exactly as originally written.

create or replace function public.record_agent_run_decision(
  p_run_id uuid,
  p_operator_user_id uuid,
  p_expected_manager_hash text,
  p_decision text,
  p_rationale text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  manager_artifact private.agent_run_artifacts%rowtype;
  existing_decision private.agent_run_decisions%rowtype;
  next_sequence integer;
  next_status text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  if p_expected_manager_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid expected manager hash' using errcode = '22023';
  end if;
  if char_length(p_rationale) < 20 or char_length(p_rationale) > 1000 then
    raise exception 'invalid decision rationale' using errcode = '22023';
  end if;
  if char_length(p_idempotency_key) < 8
    or char_length(p_idempotency_key) > 200
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  select run.* into selected_run
  from public.agent_runs run
  where run.id = p_run_id
  for update;

  if selected_run.id is null then
    raise exception 'hosted run not found' using errcode = 'P0002';
  end if;

  -- An idempotent replay returns the recorded decision unchanged and appends nothing.
  select decision.* into existing_decision
  from private.agent_run_decisions decision
  where decision.run_id = p_run_id
     or decision.idempotency_key = p_idempotency_key
  order by (decision.run_id = p_run_id) desc
  limit 1;

  if existing_decision.run_id is not null then
    if existing_decision.run_id <> p_run_id
      or existing_decision.idempotency_key <> p_idempotency_key
      or existing_decision.decision <> p_decision then
      return jsonb_build_object('recorded', false, 'reason', 'decision_conflict');
    end if;
    return jsonb_build_object(
      'recorded', true,
      'replayed', true,
      'decision', existing_decision.decision,
      'status', selected_run.status,
      'promoted', existing_decision.promoted
    );
  end if;

  -- Membership test only; no record variable, so no identifier can collide with the table alias.
  if not exists (
    select 1 from private.approval_operators approver
    where approver.auth_user_id = p_operator_user_id
  ) then
    return jsonb_build_object('recorded', false, 'reason', 'operator_not_authorised');
  end if;

  if selected_run.status <> 'awaiting_human_approval' then
    return jsonb_build_object('recorded', false, 'reason', 'run_not_at_approval_boundary');
  end if;

  select artifact.* into manager_artifact
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id
    and artifact.stage = 'manager'
    and artifact.version = 1;

  if manager_artifact.run_id is null then
    return jsonb_build_object('recorded', false, 'reason', 'manager_artifact_not_sealed');
  end if;

  -- Exact stored-hash comparison, matching the lineage discipline every worker already applies. The
  -- hash is never recomputed here and no substitute is accepted.
  if manager_artifact.artifact_hash <> p_expected_manager_hash then
    return jsonb_build_object('recorded', false, 'reason', 'manager_artifact_hash_mismatch');
  end if;

  next_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  insert into private.agent_run_decisions (
    run_id, decision, manager_artifact_hash, rationale, operator_user_id, idempotency_key, promoted
  ) values (
    p_run_id,
    p_decision,
    p_expected_manager_hash,
    p_rationale,
    p_operator_user_id,
    p_idempotency_key,
    p_decision = 'approve'
  );

  select coalesce(max(event.sequence), 0) + 1 into next_sequence
  from public.agent_run_events event
  where event.run_id = p_run_id;

  -- The public event states the governed outcome only. The operator's free-text rationale stays in the
  -- private decision record and never reaches a browser role.
  insert into public.agent_run_events (
    run_id, sequence, event_type, stage, public_summary
  ) values (
    p_run_id,
    next_sequence,
    case when p_decision = 'approve' then 'run_approved' else 'run_rejected' end,
    'manager',
    case when p_decision = 'approve'
      then 'An authenticated operator approved the sealed case record for internal promotion. No customer action was sent.'
      else 'An authenticated operator rejected the sealed case record. No customer action was sent.'
    end
  );

  update public.agent_runs
  set status = next_status,
      worker_lease_token = null,
      worker_lease_expires_at = null,
      updated_at = now(),
      stopped_at = now()
  where id = p_run_id;

  return jsonb_build_object(
    'recorded', true,
    'replayed', false,
    'decision', p_decision,
    'status', next_status,
    'promoted', p_decision = 'approve'
  );
end;
$$;

revoke all on function public.record_agent_run_decision(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_agent_run_decision(uuid, uuid, text, text, text, text)
  to service_role;
