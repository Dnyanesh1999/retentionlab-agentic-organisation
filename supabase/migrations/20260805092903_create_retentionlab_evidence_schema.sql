-- Remote migration version: 20260805092903.
-- RetentionLab's evidence store contains generated, fictional B2B SaaS data only.
-- Browser roles receive no table privileges; the future MCP server reads with a
-- server-side Supabase secret and returns an allow-listed, cited projection.

create extension if not exists pgcrypto with schema extensions;

create table public.demo_generation_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  generator_key text not null,
  generator_version text not null,
  seed bigint not null,
  status text not null default 'loading'
    check (status in ('loading', 'ready', 'failed')),
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  row_counts jsonb not null default '{}'::jsonb,
  failure_reason text,
  constraint demo_generation_runs_completion_check check (
    (status = 'loading' and completed_at is null)
    or (status in ('ready', 'failed') and completed_at is not null)
  )
);

create index demo_generation_runs_ready_idx
  on public.demo_generation_runs (generator_key, generated_at desc)
  where status = 'ready';

create table public.accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  generation_run_id uuid not null
    references public.demo_generation_runs (id) on delete cascade,
  slug text not null,
  display_name text not null,
  sector text not null,
  plan_tier text not null
    check (plan_tier in ('Scale', 'Growth', 'Enterprise')),
  lifecycle_stage text not null
    check (lifecycle_stage in ('onboarding', 'adopted', 'at_risk', 'renewal')),
  seats_purchased integer not null check (seats_purchased between 5 and 5000),
  monthly_recurring_revenue numeric(12, 2) not null
    check (monthly_recurring_revenue >= 0),
  contract_currency text not null check (contract_currency ~ '^[A-Z]{3}$'),
  renewal_at date not null,
  region text not null,
  synthetic boolean not null default true check (synthetic is true),
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (generation_run_id, slug)
);

create index accounts_generation_run_idx
  on public.accounts (generation_run_id);
create index accounts_renewal_idx
  on public.accounts (renewal_at);

create table public.product_signals (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  evidence_key text not null unique,
  signal_type text not null
    check (signal_type in ('active_users', 'feature_adoption', 'session_frequency', 'seat_utilisation')),
  metric_value numeric(12, 4) not null,
  unit text not null check (unit in ('count', 'percent', 'sessions_per_user')),
  comparison_value numeric(12, 4),
  comparison_window text check (comparison_window in ('previous_7_days', 'previous_30_days')),
  observed_at timestamptz not null,
  source_updated_at timestamptz not null,
  source_system text not null default 'synthetic_product_telemetry',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_signals_percent_range check (
    unit <> 'percent' or metric_value between 0 and 100
  )
);

create index product_signals_account_observed_idx
  on public.product_signals (account_id, observed_at desc);
create index product_signals_type_idx
  on public.product_signals (signal_type);

create table public.billing_events (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  evidence_key text not null unique,
  event_type text not null
    check (event_type in ('invoice_issued', 'payment_succeeded', 'payment_failed', 'credit_applied', 'plan_changed')),
  status text not null
    check (status in ('open', 'paid', 'failed', 'applied', 'completed')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  source_updated_at timestamptz not null,
  source_system text not null default 'synthetic_billing_ledger',
  created_at timestamptz not null default now()
);

create index billing_events_account_occurred_idx
  on public.billing_events (account_id, occurred_at desc);
create index billing_events_status_idx
  on public.billing_events (status);

create table public.support_events (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  evidence_key text not null unique,
  category text not null
    check (category in ('integration', 'workflow', 'billing', 'performance', 'access')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null check (status in ('open', 'pending', 'resolved')),
  sentiment_score numeric(4, 3) not null check (sentiment_score between -1 and 1),
  summary text not null check (char_length(summary) between 10 and 280),
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  source_updated_at timestamptz not null,
  source_system text not null default 'synthetic_support_desk',
  created_at timestamptz not null default now(),
  constraint support_events_resolution_check check (
    (status = 'resolved' and resolved_at is not null and resolved_at >= occurred_at)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index support_events_account_occurred_idx
  on public.support_events (account_id, occurred_at desc);
create index support_events_open_idx
  on public.support_events (account_id, severity)
  where status <> 'resolved';

create table public.consent_preferences (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  evidence_key text not null unique,
  allow_product_email boolean not null,
  allow_recovery_outreach boolean not null,
  allow_usage_personalisation boolean not null,
  preferred_channel text not null check (preferred_channel in ('email', 'in_app', 'none')),
  lawful_basis text not null
    check (lawful_basis in ('consent', 'contract', 'legitimate_interest')),
  source_updated_at timestamptz not null,
  source_system text not null default 'synthetic_preference_centre',
  created_at timestamptz not null default now(),
  constraint consent_channel_check check (
    preferred_channel = 'none'
    or allow_product_email
    or allow_recovery_outreach
  )
);

create table public.vendor_status_events (
  id uuid primary key default extensions.gen_random_uuid(),
  generation_run_id uuid not null
    references public.demo_generation_runs (id) on delete cascade,
  evidence_key text not null unique,
  vendor_key text not null,
  service_name text not null,
  status text not null
    check (status in ('operational', 'degraded', 'partial_outage', 'major_outage', 'resolved')),
  incident_key text,
  summary text not null check (char_length(summary) between 10 and 280),
  started_at timestamptz not null,
  resolved_at timestamptz,
  source_updated_at timestamptz not null,
  source_system text not null default 'synthetic_vendor_status',
  created_at timestamptz not null default now(),
  constraint vendor_status_resolution_check check (
    (status = 'resolved' and resolved_at is not null and resolved_at >= started_at)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index vendor_status_events_run_started_idx
  on public.vendor_status_events (generation_run_id, started_at desc);
create index vendor_status_events_vendor_idx
  on public.vendor_status_events (vendor_key, started_at desc);

alter table public.demo_generation_runs enable row level security;
alter table public.accounts enable row level security;
alter table public.product_signals enable row level security;
alter table public.billing_events enable row level security;
alter table public.support_events enable row level security;
alter table public.consent_preferences enable row level security;
alter table public.vendor_status_events enable row level security;

-- Grants and RLS are separate controls. The 2026 Supabase Data API default no
-- longer auto-grants new public tables, so privileges are made explicit here.
revoke all on table public.demo_generation_runs from public, anon, authenticated;
revoke all on table public.accounts from public, anon, authenticated;
revoke all on table public.product_signals from public, anon, authenticated;
revoke all on table public.billing_events from public, anon, authenticated;
revoke all on table public.support_events from public, anon, authenticated;
revoke all on table public.consent_preferences from public, anon, authenticated;
revoke all on table public.vendor_status_events from public, anon, authenticated;

grant select, insert, update, delete on table public.demo_generation_runs to service_role;
grant select, insert, update, delete on table public.accounts to service_role;
grant select, insert, update, delete on table public.product_signals to service_role;
grant select, insert, update, delete on table public.billing_events to service_role;
grant select, insert, update, delete on table public.support_events to service_role;
grant select, insert, update, delete on table public.consent_preferences to service_role;
grant select, insert, update, delete on table public.vendor_status_events to service_role;

comment on table public.accounts is
  'Generated fictional SaaS accounts for RetentionLab assessment demonstrations; never real customer data.';
comment on column public.accounts.synthetic is
  'Hard invariant preventing generated demo accounts from being mistaken for real customers.';
comment on column public.product_signals.evidence_key is
  'Stable citation key returned by the MCP evidence tools.';
