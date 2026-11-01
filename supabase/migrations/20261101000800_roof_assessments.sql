-- 008 Roof Photo Analysis
-- Owns: roof_assessments (immutable AI attempt log) and its RLS.
-- Spec: specs/008-roof-photo-analysis/data-model.md

create table public.roof_assessments (
  id                      uuid primary key default gen_random_uuid(),
  request_id              uuid not null references public.household_requests (id) on delete cascade,
  status                  text not null check (status in ('completed', 'failed')),
  observations            jsonb not null default '[]'::jsonb,
  potential_obstructions  jsonb not null default '[]'::jsonb,
  limitations             jsonb not null default '[]'::jsonb,
  site_survey_required    boolean not null default true,
  model                   text null,
  prompt_version          text not null,
  failure_reason          text null check (failure_reason in ('timeout', 'rate_limited', 'provider_error', 'invalid_output', 'not_configured')),
  roof_photo_path         text not null,
  created_at              timestamptz not null default now(),
  constraint roof_assessments_failure_reason_chk check ((status = 'failed') = (failure_reason is not null)),
  constraint roof_assessments_limitations_chk check (status = 'failed' or jsonb_array_length(limitations) >= 3),
  constraint roof_assessments_failed_empty_chk check (status = 'completed' or (observations = '[]'::jsonb and potential_obstructions = '[]'::jsonb)),
  constraint roof_assessments_survey_chk check (site_survey_required = true)
);

comment on table public.roof_assessments is 'AI roof photo observations (never measurements). Immutable; one row per attempt.';

create index roof_assessments_request_created_idx on public.roof_assessments (request_id, created_at desc);

alter table public.roof_assessments enable row level security;

create policy roof_assessments_select_owner on public.roof_assessments
  for select to authenticated
  using (exists (
    select 1 from public.household_requests r
    where r.id = request_id and r.user_id = (select auth.uid())
  ));

create policy roof_assessments_insert_owner_consented on public.roof_assessments
  for insert to authenticated
  with check (exists (
    select 1 from public.household_requests r
    where r.id = request_id and r.user_id = (select auth.uid()) and r.ai_consent = true
  ));
