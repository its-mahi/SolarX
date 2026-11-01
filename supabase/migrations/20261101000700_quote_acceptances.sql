-- 007 Quote Acceptance
-- Owns: quote_acceptances table + RLS (SELECT only), accept_quote, close_request,
-- accepted_household_contact, household_acceptance_summary.
-- Spec: specs/007-quote-acceptance/data-model.md. Lock order is always request row -> quote rows.
-- Error reasons are placed in the RAISE message text (the API mapper reads them there).

create table public.quote_acceptances (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes (id) on delete cascade,
  request_id   uuid not null references public.household_requests (id) on delete cascade,
  household_id uuid not null references public.profiles (id) on delete cascade,
  accepted_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint quote_acceptances_quote_id_key unique (quote_id),
  constraint quote_acceptances_request_id_key unique (request_id)
);

comment on table public.quote_acceptances is 'One immutable acceptance per request (D-03). Rows are inserted only by accept_quote().';

create index quote_acceptances_household_id_idx on public.quote_acceptances (household_id);

alter table public.quote_acceptances enable row level security;

create policy quote_acceptances_select_household on public.quote_acceptances
  for select to authenticated
  using (household_id = (select auth.uid()));

create policy quote_acceptances_select_accepted_vendor on public.quote_acceptances
  for select to authenticated
  using (exists (
    select 1 from public.quotes q
    join public.vendors v on v.id = q.vendor_id
    where q.id = quote_acceptances.quote_id and v.user_id = (select auth.uid())
  ));

-- Deliberately no INSERT / UPDATE / DELETE policies: the row is created only inside accept_quote()
-- (SECURITY DEFINER), so an acceptance can never be forged or altered by a client.

-------------------------------------------------------------------------------
-- Household guard
-------------------------------------------------------------------------------

create or replace function public.acceptance_current_household_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'household' then
    raise exception 'FORBIDDEN: household role required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke all on function public.acceptance_current_household_id() from public, anon;
grant execute on function public.acceptance_current_household_id() to authenticated;

-------------------------------------------------------------------------------
-- accept_quote
-------------------------------------------------------------------------------

create or replace function public.accept_quote(p_quote_id uuid)
returns table (
  acceptance_id uuid,
  quote_id uuid,
  request_id uuid,
  household_id uuid,
  accepted_at timestamptz,
  rejected_quote_ids uuid[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_household uuid;
  v_request_id uuid;
  v_req_owner uuid;
  v_req_status text;
  v_quote_status text;
  v_rejected uuid[];
  v_acc public.quote_acceptances;
begin
  v_household := public.acceptance_current_household_id();

  select q.request_id into v_request_id from public.quotes q where q.id = p_quote_id;
  if v_request_id is null then
    raise exception 'QUOTE_NOT_FOUND' using errcode = 'SM404';
  end if;

  -- Request lock first: serialises every acceptance attempt for this request.
  select hr.user_id, hr.status into v_req_owner, v_req_status
  from public.household_requests hr where hr.id = v_request_id for update;
  if v_req_owner is null or v_req_owner <> v_household then
    raise exception 'QUOTE_NOT_FOUND' using errcode = 'SM404';
  end if;

  if v_req_status in ('accepted', 'closed')
     or exists (select 1 from public.quote_acceptances qa where qa.request_id = v_request_id) then
    raise exception 'ALREADY_ACCEPTED' using errcode = 'SM409';
  end if;
  if v_req_status not in ('open', 'quoted') then
    raise exception 'REQUEST_NOT_ACCEPTING' using errcode = 'SM409';
  end if;

  select q.status into v_quote_status from public.quotes q where q.id = p_quote_id for update;
  if v_quote_status is distinct from 'submitted' then
    raise exception 'QUOTE_NOT_ACCEPTABLE: quote status is %', coalesce(v_quote_status, 'unknown') using errcode = 'SM409';
  end if;

  update public.quotes set status = 'accepted', updated_at = now() where id = p_quote_id;

  with rejected as (
    update public.quotes set status = 'rejected', updated_at = now()
    where request_id = v_request_id and id <> p_quote_id and status = 'submitted'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_rejected from rejected;

  update public.household_requests set status = 'accepted' where id = v_request_id;

  insert into public.quote_acceptances (quote_id, request_id, household_id)
  values (p_quote_id, v_request_id, v_household)
  returning * into v_acc;

  return query select v_acc.id, v_acc.quote_id, v_acc.request_id, v_acc.household_id, v_acc.accepted_at, v_rejected;
end;
$$;

revoke all on function public.accept_quote(uuid) from public, anon;
grant execute on function public.accept_quote(uuid) to authenticated;

-------------------------------------------------------------------------------
-- close_request
-------------------------------------------------------------------------------

create or replace function public.close_request(p_request_id uuid)
returns public.household_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_req public.household_requests;
begin
  v_household := public.acceptance_current_household_id();

  select * into v_req from public.household_requests hr where hr.id = p_request_id for update;
  if not found or v_req.user_id <> v_household then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'SM404';
  end if;
  if v_req.status <> 'accepted' then
    raise exception 'REQUEST_NOT_CLOSABLE' using errcode = 'SM409';
  end if;

  update public.household_requests set status = 'closed', updated_at = now()
  where id = p_request_id returning * into v_req;
  return v_req;
end;
$$;

revoke all on function public.close_request(uuid) from public, anon;
grant execute on function public.close_request(uuid) to authenticated;

-------------------------------------------------------------------------------
-- accepted_household_contact (accepted vendor only)
-------------------------------------------------------------------------------

create or replace function public.accepted_household_contact(p_quote_id uuid)
returns table (
  request_id uuid,
  household_name text,
  household_phone text,
  address_text text,
  latitude double precision,
  longitude double precision,
  locality text,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_vendor_id uuid;
  v_status text;
  v_req uuid;
begin
  v_vendor_id := public.quotes_current_vendor_id();

  select q.status, q.request_id into v_status, v_req
  from public.quotes q where q.id = p_quote_id and q.vendor_id = v_vendor_id;
  if v_req is null then
    raise exception 'QUOTE_NOT_FOUND' using errcode = 'SM404';
  end if;

  if v_status <> 'accepted'
     or not exists (select 1 from public.quote_acceptances qa where qa.quote_id = p_quote_id) then
    raise exception 'CONTACT_NOT_AVAILABLE' using errcode = 'SM403';
  end if;

  return query
    select hr.id, p.name, p.phone, hr.address_text, hr.latitude::double precision, hr.longitude::double precision,
           hr.locality, qa.accepted_at
    from public.quote_acceptances qa
    join public.household_requests hr on hr.id = qa.request_id
    join public.profiles p on p.id = hr.user_id
    where qa.quote_id = p_quote_id;
end;
$$;

revoke all on function public.accepted_household_contact(uuid) from public, anon;
grant execute on function public.accepted_household_contact(uuid) to authenticated;

-------------------------------------------------------------------------------
-- household_acceptance_summary (owning household only)
-------------------------------------------------------------------------------

create or replace function public.household_acceptance_summary(p_request_id uuid)
returns table (
  quote_id uuid,
  accepted_at timestamptz,
  vendor_company_name text,
  vendor_is_demo boolean,
  vendor_phone text,
  price integer,
  capacity_kw numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_household uuid;
begin
  v_household := public.acceptance_current_household_id();

  return query
    select qa.quote_id, qa.accepted_at, v.company_name, p.is_demo, p.phone, q.price, q.capacity_kw
    from public.quote_acceptances qa
    join public.household_requests hr on hr.id = qa.request_id
    join public.quotes q on q.id = qa.quote_id
    join public.vendors v on v.id = q.vendor_id
    join public.profiles p on p.id = v.user_id
    where qa.request_id = p_request_id and hr.user_id = v_household;
end;
$$;

revoke all on function public.household_acceptance_summary(uuid) from public, anon;
grant execute on function public.household_acceptance_summary(uuid) to authenticated;
