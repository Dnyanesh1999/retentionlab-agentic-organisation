-- Explicit service-only policies complement revoked browser grants. The
-- service role also bypasses RLS, but naming the intended principal keeps the
-- access boundary auditable and avoids relying on an implicit deny alone.

create policy "Service role manages hosted runs"
  on public.agent_runs
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role manages hosted run events"
  on public.agent_run_events
  for all
  to service_role
  using (true)
  with check (true);
