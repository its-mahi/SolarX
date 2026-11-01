-- 006 Quote Comparison and Scoring
-- Owns: quote_reviews (one saved review per compared quote). Spec: specs/006-quote-comparison-scoring/data-model.md
-- Writes happen only through POST /api/quotes/compare (service role after an ownership check);
-- there are deliberately no insert/update/delete policies. Vendors cannot read reviews (scores reveal competitor prices).

create table public.quote_reviews (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null unique references public.quotes (id) on delete cascade,
  normalized_fields jsonb not null default '{}'::jsonb,
  missing_fields    jsonb not null default '[]'::jsonb,
  flags             jsonb not null default '[]'::jsonb,
  score_breakdown   jsonb not null default '{}'::jsonb,
  total_score       numeric(4, 1) not null check (total_score >= 0 and total_score <= 100),
  scoring_version   text not null check (char_length(scoring_version) between 1 and 64),
  explanation       text not null check (char_length(explanation) <= 500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.quote_reviews is 'Code-computed comparison reviews of quotes. Never written by AI or by clients.';

create trigger quote_reviews_set_updated_at
  before update on public.quote_reviews
  for each row execute function public.set_updated_at();

alter table public.quote_reviews enable row level security;

create policy quote_reviews_select_request_owner on public.quote_reviews
  for select to authenticated
  using (exists (
    select 1
    from public.quotes q
    join public.household_requests r on r.id = q.request_id
    where q.id = quote_reviews.quote_id and r.user_id = (select auth.uid())
  ));
