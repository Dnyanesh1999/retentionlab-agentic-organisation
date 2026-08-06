-- Remote migration version: 20260805233206.
-- Purpose-limited workflow observations are stored outside the exposed Data API
-- schema and can be written only through the service-only atomic RPC below.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.recovery_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  account_slug text not null
    check (account_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  generation_run_id uuid not null,
  purpose_code text not null default 'workflow_clarification_v1'
    check (purpose_code = 'workflow_clarification_v1'),
  status text not null default 'active'
    check (status in ('active', 'consumed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  submission_id uuid unique,
  constraint recovery_sessions_state_check check (
    (status = 'active' and consumed_at is null and submission_id is null)
    or (status = 'consumed' and consumed_at is not null and submission_id is not null)
    or (status in ('expired', 'revoked') and consumed_at is null and submission_id is null)
  ),
  constraint recovery_sessions_expiry_check check (expires_at > created_at)
);

create index recovery_sessions_active_expiry_idx
  on private.recovery_sessions (expires_at)
  where status = 'active';

create table private.clarification_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique
    references private.recovery_sessions (id),
  request_id uuid not null unique,
  account_slug text not null,
  generation_run_id uuid not null,
  support_evidence_key text not null,
  preference_evidence_key text not null,
  observation text
    check (observation is null or char_length(observation) between 1 and 500),
  purpose_code text not null
    check (purpose_code = 'workflow_clarification_v1'),
  consent_action text not null
    check (consent_action = 'share_observation'),
  consent_copy_version text not null
    check (consent_copy_version = 'clarification-consent.v1'),
  client_schema_version text not null
    check (client_schema_version = 'clarification-submission.v1'),
  payload_sha256 text not null
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  edge_function_version text not null
    check (char_length(edge_function_version) between 1 and 80),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  retention_expires_at timestamptz not null,
  redacted_at timestamptz,
  constraint clarification_retention_check check (
    retention_expires_at > created_at
    and (redacted_at is null or redacted_at >= created_at)
  )
);

alter table private.recovery_sessions
  add constraint recovery_sessions_submission_fk
  foreign key (submission_id)
  references private.clarification_submissions (id)
  deferrable initially deferred;

create index clarification_submissions_retention_idx
  on private.clarification_submissions (retention_expires_at)
  where redacted_at is null;

alter table private.recovery_sessions enable row level security;
alter table private.clarification_submissions enable row level security;

revoke all on table private.recovery_sessions from public, anon, authenticated;
revoke all on table private.clarification_submissions from public, anon, authenticated;
revoke all on table private.recovery_sessions from service_role;
revoke all on table private.clarification_submissions from service_role;

create or replace function public.submit_recovery_clarification(
  p_token_hash text,
  p_request_id uuid,
  p_account_slug text,
  p_support_evidence_key text,
  p_preference_evidence_key text,
  p_observation text,
  p_payload_sha256 text,
  p_edge_function_version text
)
returns table (
  submission_id uuid,
  accepted_at timestamptz,
  replayed boolean,
  result_code text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session private.recovery_sessions%rowtype;
  v_existing private.clarification_submissions%rowtype;
  v_account_id uuid;
  v_submission_id uuid;
  v_accepted_at timestamptz;
  v_observation text;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
    or p_request_id is null
    or p_account_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(p_account_slug) > 80
    or p_support_evidence_key !~ '^support:[a-z0-9-]+:[a-z0-9-]+$'
    or p_preference_evidence_key !~ '^preference:[a-z0-9-]+:[a-z0-9-]+$'
    or p_payload_sha256 !~ '^[0-9a-f]{64}$'
    or p_edge_function_version is null
    or char_length(p_edge_function_version) not between 1 and 80
    or (p_observation is not null and char_length(btrim(p_observation)) > 500)
  then
    return query select null::uuid, null::timestamptz, false, 'invalid_request'::text;
    return;
  end if;

  v_observation := nullif(btrim(p_observation), '');

  select sessions.*
    into v_session
    from private.recovery_sessions as sessions
    where sessions.token_hash = p_token_hash
    for update;

  if not found then
    return query select null::uuid, null::timestamptz, false, 'forbidden'::text;
    return;
  end if;

  if v_session.status = 'consumed' then
    select submissions.*
      into v_existing
      from private.clarification_submissions as submissions
      where submissions.session_id = v_session.id;

    if found
      and v_existing.request_id = p_request_id
      and v_existing.payload_sha256 = p_payload_sha256
    then
      return query
        select v_existing.id, v_existing.consented_at, true, 'accepted'::text;
    else
      return query select null::uuid, null::timestamptz, false, 'conflict'::text;
    end if;
    return;
  end if;

  if v_session.status <> 'active' or v_session.expires_at <= clock_timestamp() then
    if v_session.status = 'active' then
      update private.recovery_sessions
        set status = 'expired'
        where id = v_session.id;
    end if;
    return query select null::uuid, null::timestamptz, false, 'forbidden'::text;
    return;
  end if;

  if v_session.account_slug <> p_account_slug
    or v_session.purpose_code <> 'workflow_clarification_v1'
  then
    return query select null::uuid, null::timestamptz, false, 'forbidden'::text;
    return;
  end if;

  select accounts.id
    into v_account_id
    from public.accounts as accounts
    join public.demo_generation_runs as runs
      on runs.id = accounts.generation_run_id
    where accounts.slug = p_account_slug
      and accounts.generation_run_id = v_session.generation_run_id
      and accounts.synthetic is true
      and runs.status = 'ready'
    limit 1;

  if not found
    or not exists (
      select 1
      from public.support_events as support
      where support.account_id = v_account_id
        and support.evidence_key = p_support_evidence_key
        and support.category = 'workflow'
        and support.severity = 'medium'
        and support.status = 'open'
        and support.resolved_at is null
    )
    or not exists (
      select 1
      from public.consent_preferences as preference
      where preference.account_id = v_account_id
        and preference.evidence_key = p_preference_evidence_key
        and preference.allow_recovery_outreach is true
    )
  then
    return query select null::uuid, null::timestamptz, false, 'invalid_evidence'::text;
    return;
  end if;

  v_submission_id := extensions.gen_random_uuid();
  v_accepted_at := clock_timestamp();

  insert into private.clarification_submissions (
    id,
    session_id,
    request_id,
    account_slug,
    generation_run_id,
    support_evidence_key,
    preference_evidence_key,
    observation,
    purpose_code,
    consent_action,
    consent_copy_version,
    client_schema_version,
    payload_sha256,
    edge_function_version,
    consented_at,
    retention_expires_at
  )
  values (
    v_submission_id,
    v_session.id,
    p_request_id,
    p_account_slug,
    v_session.generation_run_id,
    p_support_evidence_key,
    p_preference_evidence_key,
    v_observation,
    'workflow_clarification_v1',
    'share_observation',
    'clarification-consent.v1',
    'clarification-submission.v1',
    p_payload_sha256,
    p_edge_function_version,
    v_accepted_at,
    v_accepted_at + interval '30 days'
  );

  update private.recovery_sessions
    set status = 'consumed',
        consumed_at = v_accepted_at,
        submission_id = v_submission_id
    where id = v_session.id;

  return query select v_submission_id, v_accepted_at, false, 'accepted'::text;
end;
$function$;

revoke all on function public.submit_recovery_clarification(
  text, uuid, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_recovery_clarification(
  text, uuid, text, text, text, text, text, text
) to service_role;

comment on table private.recovery_sessions is
  'Hashed, short-lived, single-use capabilities for fictional RetentionLab recovery invitations.';
comment on table private.clarification_submissions is
  'Purpose-limited synthetic workflow observations persisted only after explicit Share observation consent.';
comment on function public.submit_recovery_clarification(
  text, uuid, text, text, text, text, text, text
) is
  'Service-only atomic validation, idempotency and consent logging boundary for RetentionLab clarification.';
