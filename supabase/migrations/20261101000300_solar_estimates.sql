-- 003 Solar Financial Engine
-- Owns: solar_estimates (one saved estimate per request). Written only by the server (service role).
-- Spec: specs/003-solar-financial-engine/data-model.md

create table public.solar_estimates (
  id                      uuid primary key default gen_random_uuid(),
  request_id              uuid not null unique references public.household_requests (id) on delete cascade,
  capacity_kw             numeric(5, 2) not null check (capacity_kw > 0 and capacity_kw <= 100),
  installation_cost       integer not null check (installation_cost >= 0),
  subsidy_estimate        integer not null check (subsidy_estimate >= 0),
  net_cost                integer not null check (net_cost >= 0),
  annual_generation_kwh   integer not null check (annual_generation_kwh >= 0),
  annual_savings_estimate integer not null check (annual_savings_estimate >= 0),
  payback_years           numeric(5, 1) null check (payback_years is null or payback_years >= 0),
  assumptions             jsonb not null default '{}'::jsonb,
  rule_version            text not null check (char_length(rule_version) between 1 and 64),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.solar_estimates is 'Indicative, code-calculated estimate per request. Rows are written only by the server.';

create trigger solar_estimates_set_updated_at
  before update on public.solar_estimates
  for each row execute function public.set_updated_at();

-- RLS: owner can read; no insert/update/delete policy = denied for browsers.
alter table public.solar_estimates enable row level security;

create policy solar_estimates_select_owner on public.solar_estimates
  for select to authenticated
  using (
    exists (
      select 1 from public.household_requests r
      where r.id = solar_estimates.request_id and r.user_id = (select auth.uid())
    )
  );
