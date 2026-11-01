-- 005 Vendor Quote Submission
-- Owns: quotes table, RLS (SELECT only), submit_quote / withdraw_quote / vendor_quoted_request_summaries.
-- Spec: specs/005-vendor-quote-submission/data-model.md
-- Error reasons are placed in the RAISE message text (the API mapper reads them there).

create table public.quotes (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null references public.household_requests (id) on delete cascade,
  vendor_id              uuid not null references public.vendors (id) on delete cascade,
  price                  integer not null check (price between 1000 and 10000000),
  capacity_kw            numeric(6, 2) not null check (capacity_kw > 0 and capacity_kw <= 100),
  panel_details          jsonb not null default '{}'::jsonb check (jsonb_typeof(panel_details) = 'object'),
  inverter_details       jsonb not null default '{}'::jsonb check (jsonb_typeof(inverter_details) = 'object'),
  warranty_details       jsonb not null default '{}'::jsonb check (jsonb_typeof(warranty_details) = 'object'),
  installation_days      integer not null check (installation_days between 1 and 365),
  earthing_included      boolean null,
  documentation_included boolean null,
  other_inclusions       jsonb not null default '[]'::jsonb check (jsonb_typeof(other_inclusions) = 'array'),
  exclusions             text null check (char_length(exclusions) <= 2000),
  vendor_notes           text null check (char_length(vendor_notes) <= 2000),
  source                 text not null default 'manual' check (source in ('manual', 'ai_extracted')),
  source_document_path   text null,
  status                 text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected', 'withdrawn')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.quotes is 'Vendor quotes. Vendor free text is untrusted data; writes only via SQL functions.';

create unique index quotes_one_active_per_vendor_request
  on public.quotes (request_id, vendor_id) where status in ('submitted', 'accepted');
create index quotes_request_id_idx on public.quotes (request_id);
create index quotes_vendor_created_idx on public.quotes (vendor_id, created_at desc);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;

create policy quotes_select_own_vendor on public.quotes
  for select to authenticated
  using (vendor_id in (select v.id from public.vendors v where v.user_id = (select auth.uid())));

create policy quotes_select_request_owner on public.quotes
  for select to authenticated
  using (exists (
    select 1 from public.household_requests hr
    where hr.id = quotes.request_id and hr.user_id = (select auth.uid())
  ));

-- Deliberately no INSERT / UPDATE / DELETE policies: every write goes through the
-- SECURITY DEFINER functions below (and 007's acceptance function), so price/status cannot be forged.

-------------------------------------------------------------------------------
-- Vendor guard
-------------------------------------------------------------------------------

create or replace function public.quotes_current_vendor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'vendor' then
    raise exception 'FORBIDDEN: vendor role required' using errcode = '42501';
  end if;
  select v.id into v_vendor_id from public.vendors v where v.user_id = auth.uid();
  if v_vendor_id is null then
    raise exception 'VENDOR_PROFILE_MISSING' using errcode = 'SM403';
  end if;
  return v_vendor_id;
end;
$$;

revoke all on function public.quotes_current_vendor_id() from public, anon;
grant execute on function public.quotes_current_vendor_id() to authenticated;

-------------------------------------------------------------------------------
-- submit_quote
-------------------------------------------------------------------------------

create or replace function public.submit_quote(
  p_request_id uuid,
  p_price integer,
  p_capacity_kw numeric,
  p_panel_details jsonb,
  p_inverter_details jsonb,
  p_warranty_details jsonb,
  p_installation_days integer,
  p_earthing_included boolean,
  p_documentation_included boolean,
  p_other_inclusions jsonb,
  p_exclusions text,
  p_vendor_notes text
)
returns public.quotes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor_id uuid;
  v_status text;
  v_quote public.quotes;
begin
  v_vendor_id := public.quotes_current_vendor_id();

  select hr.status into v_status from public.household_requests hr where hr.id = p_request_id for update;
  if v_status is null or v_status = 'draft' then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'SM404';
  end if;
  if v_status not in ('open', 'quoted') then
    raise exception 'REQUEST_NOT_QUOTABLE' using errcode = 'SM409';
  end if;

  if exists (
    select 1 from public.quotes q
    where q.request_id = p_request_id and q.vendor_id = v_vendor_id and q.status in ('submitted', 'accepted')
  ) then
    raise exception 'DUPLICATE_ACTIVE_QUOTE' using errcode = 'SM409';
  end if;

  insert into public.quotes (
    request_id, vendor_id, price, capacity_kw, panel_details, inverter_details, warranty_details,
    installation_days, earthing_included, documentation_included, other_inclusions,
    exclusions, vendor_notes, source, status
  ) values (
    p_request_id, v_vendor_id, p_price, p_capacity_kw,
    coalesce(p_panel_details, '{}'::jsonb), coalesce(p_inverter_details, '{}'::jsonb),
    coalesce(p_warranty_details, '{}'::jsonb),
    p_installation_days, p_earthing_included, p_documentation_included,
    coalesce(p_other_inclusions, '[]'::jsonb), p_exclusions, p_vendor_notes, 'manual', 'submitted'
  ) returning * into v_quote;

  update public.household_requests set status = 'quoted' where id = p_request_id and status = 'open';

  return v_quote;
end;
$$;

revoke all on function public.submit_quote(uuid, integer, numeric, jsonb, jsonb, jsonb, integer, boolean, boolean, jsonb, text, text) from public, anon;
grant execute on function public.submit_quote(uuid, integer, numeric, jsonb, jsonb, jsonb, integer, boolean, boolean, jsonb, text, text) to authenticated;

-------------------------------------------------------------------------------
-- withdraw_quote
-------------------------------------------------------------------------------

create or replace function public.withdraw_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor_id uuid;
  v_quote public.quotes;
begin
  v_vendor_id := public.quotes_current_vendor_id();

  select * into v_quote from public.quotes q where q.id = p_quote_id and q.vendor_id = v_vendor_id for update;
  if not found then
    raise exception 'QUOTE_NOT_FOUND' using errcode = 'SM404';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception 'QUOTE_NOT_WITHDRAWABLE' using errcode = 'SM409';
  end if;

  update public.quotes set status = 'withdrawn', updated_at = now() where id = v_quote.id returning * into v_quote;
  return v_quote;
end;
$$;

revoke all on function public.withdraw_quote(uuid) from public, anon;
grant execute on function public.withdraw_quote(uuid) to authenticated;

-------------------------------------------------------------------------------
-- vendor_quoted_request_summaries (locality + status only, for requests the caller quoted)
-------------------------------------------------------------------------------

create or replace function public.vendor_quoted_request_summaries()
returns table (request_id uuid, locality text, request_status text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := public.quotes_current_vendor_id();
  return query
    select hr.id, hr.locality, hr.status::text
    from public.household_requests hr
    where exists (select 1 from public.quotes q where q.request_id = hr.id and q.vendor_id = v_vendor_id);
end;
$$;

revoke all on function public.vendor_quoted_request_summaries() from public, anon;
grant execute on function public.vendor_quoted_request_summaries() to authenticated;
