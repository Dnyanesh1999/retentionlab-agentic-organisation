-- Authenticated human approval for a run paused at the mandatory decision boundary.
--
-- A decision is recorded only for an authenticated, allow-listed operator, only while the run sits at
-- `awaiting_human_approval`, and only when the caller presents the exact stored Manager artefact hash.
-- Approval clears the sealed case record for internal portfolio promotion. It authorises no send, no
-- publish, no deploy and no customer data mutation: `requires_human_approval` and
-- `external_actions_permitted` are never touched here, and no existing event is ever updated.

-- --- Lifecycle -----------------------------------------------------------------------------------

-- `approved` and `rejected` are terminal. Replace the inline status check by definition rather than by
-- generated name so this migration cannot silently leave the original constraint in place.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.agent_runs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%awaiting_human_approval%'
  loop
    execute format('alter table public.agent_runs drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.agent_runs
  add constraint agent_runs_status_allowed_check check (
    status in ('queued', 'in_progress', 'awaiting_human_approval', 'approved', 'rejected', 'failed')
  );

-- A decided run is no longer open, so its account becomes available for a new governed run. The open
-- set is unchanged; only the two new terminal states fall outside it.
drop index if exists public.agent_runs_one_open_per_account_idx;

create unique index agent_runs_one_open_per_account_idx
  on public.agent_runs (account_id)
  where status in ('queued', 'in_progress', 'awaiting_human_approval');

-- --- Event vocabulary ----------------------------------------------------------------------------

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.agent_run_events'::regclass
      and contype = 'c'
      and conname <> 'agent_run_events_type_stage_check'
      and pg_get_constraintdef(oid) like '%run_paused_for_approval%'
  loop
    execute format('alter table public.agent_run_events drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.agent_run_events
  add constraint agent_run_events_event_type_allowed_check check (
    event_type in (
      'run_created', 'stage_started', 'stage_completed',
      'run_paused_for_approval', 'run_failed',
      'run_approved', 'run_rejected'
    )
  );

alter table public.agent_run_events
  drop constraint agent_run_events_type_stage_check;

alter table public.agent_run_events
  add constraint agent_run_events_type_stage_check check (
    (event_type = 'run_created' and stage is null)
    or (
      event_type in (
        'stage_started', 'stage_completed', 'run_paused_for_approval', 'run_failed',
        'run_approved', 'run_rejected'
      )
      and stage is not null
    )
  );

-- --- Operator identity ---------------------------------------------------------------------------

-- The authorised human decision-makers. Seeded out of band against a real Supabase Auth user; no
-- credential or synthetic customer record belongs in this table.
create table private.approval_operators (
  auth_user_id uuid primary key,
  display_name text not null check (char_length(display_name) between 2 and 120),
  created_at timestamptz not null default now()
);

alter table private.approval_operators enable row level security;
revoke all on table private.approval_operators from public, anon, authenticated, service_role;

-- --- Decision record -----------------------------------------------------------------------------

create table private.agent_run_decisions (
  run_id uuid primary key references public.agent_runs (id) on delete restrict,
  decision text not null check (decision in ('approve', 'reject')),
  manager_artifact_hash text not null check (manager_artifact_hash ~ '^[0-9a-f]{64}$'),
  rationale text not null check (char_length(rationale) between 20 and 1000),
  operator_user_id uuid not null references private.approval_operators (auth_user_id) on delete restrict,
  idempotency_key text not null unique
    check (
      char_length(idempotency_key) between 8 and 200
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    ),
  promoted boolean not null default false,
  decided_at timestamptz not null default now(),
  constraint agent_run_decisions_promotion_check check (promoted is false or decision = 'approve')
);

alter table private.agent_run_decisions enable row level security;
revoke all on table private.agent_run_decisions from public, anon, authenticated, service_role;

-- --- Decision RPC --------------------------------------------------------------------------------

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
  operator private.approval_operators%rowtype;
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

  select operator.* into operator
  from private.approval_operators operator
  where operator.auth_user_id = p_operator_user_id;

  if operator.auth_user_id is null then
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

-- --- Decision context ----------------------------------------------------------------------------

-- The bounded context an authorised operator needs in order to decide, and nothing more. It returns
-- the sealed Manager hash so the operator attests to the exact artefact they reviewed, plus the
-- governance flags and the single consented channel. It never returns an artefact body, a prompt, a
-- rationale or any other stage's hash.
create or replace function public.get_agent_run_decision_context(
  p_run_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run public.agent_runs%rowtype;
  manager_artifact private.agent_run_artifacts%rowtype;
  communicator_artifact private.agent_run_artifacts%rowtype;
begin
  if not exists (
    select 1 from private.approval_operators operator
    where operator.auth_user_id = p_operator_user_id
  ) then
    return jsonb_build_object('available', false, 'reason', 'operator_not_authorised');
  end if;

  select run.* into selected_run
  from public.agent_runs run
  where run.id = p_run_id;

  if selected_run.id is null then
    raise exception 'hosted run not found' using errcode = 'P0002';
  end if;
  if selected_run.status <> 'awaiting_human_approval' then
    return jsonb_build_object('available', false, 'reason', 'run_not_at_approval_boundary');
  end if;

  select artifact.* into manager_artifact
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'manager' and artifact.version = 1;

  if manager_artifact.run_id is null then
    return jsonb_build_object('available', false, 'reason', 'manager_artifact_not_sealed');
  end if;

  select artifact.* into communicator_artifact
  from private.agent_run_artifacts artifact
  where artifact.run_id = p_run_id and artifact.stage = 'communicator' and artifact.version = 1;

  return jsonb_build_object(
    'available', true,
    'manager_artifact_sha256', manager_artifact.artifact_hash,
    'chain_verified', coalesce((manager_artifact.artifact #>> '{lineage,chain_verified}')::boolean, false),
    'human_approval_required', coalesce((manager_artifact.artifact #>> '{governance,human_approval_required}')::boolean, true),
    'autonomous_external_actions', coalesce((manager_artifact.artifact #>> '{governance,autonomous_external_actions}')::boolean, false),
    'permitted_next_action', manager_artifact.artifact #>> '{governance,permitted_next_action}',
    'consented_channel', communicator_artifact.artifact #>> '{invitation,channel}',
    'external_actions_permitted', selected_run.external_actions_permitted
  );
end;
$$;

revoke all on function public.get_agent_run_decision_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_agent_run_decision_context(uuid, uuid) to service_role;

comment on function public.get_agent_run_decision_context(uuid, uuid) is
  'Bounded decision context for an authorised operator: sealed Manager hash, governance flags and consented channel only.';

-- --- Portfolio promotion -------------------------------------------------------------------------

-- The public-safe projection of an approved case. A case appears only after a human approval set
-- `promoted`, and it carries the same bounded stage summaries the run event stream already exposes.
-- It never returns an artefact body, a prompt, an artefact hash, the operator rationale or the
-- operator identity.
create or replace function public.list_promoted_agent_runs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  return coalesce(
    (
      select jsonb_agg(promoted_case order by promoted_case ->> 'approved_at' desc)
      from (
        select jsonb_build_object(
          'run_id', run.id,
          'account_slug', run.account_slug,
          'account_display_name', account.display_name,
          'objective', run.objective,
          'approved_at', decision.decided_at,
          'external_actions_permitted', run.external_actions_permitted,
          'stage_summaries', (
            select coalesce(jsonb_agg(
              jsonb_build_object('stage', event.stage, 'public_summary', event.public_summary)
              order by event.sequence
            ), '[]'::jsonb)
            from public.agent_run_events event
            where event.run_id = run.id
              and event.event_type = 'stage_completed'
          )
        ) as promoted_case
        from private.agent_run_decisions decision
        join public.agent_runs run on run.id = decision.run_id
        join public.accounts account on account.id = run.account_id
        where decision.promoted is true
          and decision.decision = 'approve'
          and run.status = 'approved'
        order by decision.decided_at desc
        limit bounded_limit
      ) as promoted_cases
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_promoted_agent_runs(integer) from public, anon, authenticated;
grant execute on function public.list_promoted_agent_runs(integer) to service_role;

comment on function public.list_promoted_agent_runs(integer) is
  'Public-safe approved case projection: bounded stage summaries only, never artefacts, hashes or rationale.';

comment on table private.approval_operators is
  'Authorised human approvers; never exposed to browser roles and never holds a credential.';
comment on table private.agent_run_decisions is
  'Private human decision record; the operator rationale never reaches a public event.';
comment on function public.record_agent_run_decision(uuid, uuid, text, text, text, text) is
  'Records one idempotent human decision for a run at the approval boundary against the exact sealed Manager hash.';
