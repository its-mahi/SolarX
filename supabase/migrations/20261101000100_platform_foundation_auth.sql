-- 001 Platform Foundation and Authentication
-- Owns: profiles, vendors, shared helper functions, sign-up trigger, guard triggers, RLS.
-- Spec: specs/001-platform-foundation-auth/data-model.md

-------------------------------------------------------------------------------
-- Shared helpers (reused by every later migration)
-------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True for seed/admin sessions (postgres, supabase_admin, service_role).
create or replace function public.is_privileged_session()
returns boolean
language sql
stable
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  phone       text null check (phone is null or phone ~ '^\+91[6-9][0-9]{9}$'),
  role        text not null check (role in ('household', 'vendor')),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per account. role and is_demo are fixed after creation.';

-- Role of the signed-in user, or NULL. Used inside RLS policies by later features.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-------------------------------------------------------------------------------
-- vendors
-------------------------------------------------------------------------------

create table public.vendors (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.profiles (id) on delete cascade,
  company_name         text not null check (char_length(btrim(company_name)) between 2 and 120),
  service_area         text not null check (char_length(btrim(service_area)) between 2 and 200),
  latitude             numeric(9, 6) null check (latitude between -90 and 90),
  longitude            numeric(9, 6) null check (longitude between -180 and 180),
  service_radius_km    integer not null default 25 check (service_radius_km between 1 and 500),
  verification_status  text not null default 'unverified' check (verification_status in ('unverified', 'demo')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint vendors_location_pair_chk check ((latitude is null) = (longitude is null))
);

comment on table public.vendors is 'Vendor business profile; exactly one per vendor account.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Sign-up trigger: creates profile (+ vendor) atomically with the account
-------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := meta ->> 'role';
begin
  if v_role is null or v_role not in ('household', 'vendor') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  -- is_demo from metadata is ignored on purpose; only the seed can set it.
  insert into public.profiles (id, name, phone, role, is_demo)
  values (new.id, btrim(meta ->> 'name'), nullif(meta ->> 'phone', ''), v_role, false);

  if v_role = 'vendor' then
    if coalesce(btrim(meta ->> 'company_name'), '') = '' or coalesce(btrim(meta ->> 'service_area'), '') = '' then
      raise exception 'vendor profile requires company_name and service_area' using errcode = '22023';
    end if;

    insert into public.vendors (user_id, company_name, service_area, latitude, longitude, service_radius_km, verification_status)
    values (
      new.id,
      btrim(meta ->> 'company_name'),
      btrim(meta ->> 'service_area'),
      nullif(meta ->> 'latitude', '')::numeric,
      nullif(meta ->> 'longitude', '')::numeric,
      coalesce(nullif(meta ->> 'service_radius_km', '')::integer, 25),
      'unverified'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Guard triggers: protected columns cannot be changed by end users
-------------------------------------------------------------------------------

create or replace function public.profiles_guard_update()
returns trigger
language plpgsql
as $$
begin
  if (new.id is distinct from old.id
      or new.role is distinct from old.role
      or new.is_demo is distinct from old.is_demo)
     and not public.is_privileged_session() then
    raise exception 'role, is_demo and id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard_update();

create or replace function public.vendors_guard_write()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'vendor') then
    raise exception 'vendor profile requires an account with role vendor' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and (new.user_id is distinct from old.user_id
          or new.verification_status is distinct from old.verification_status)
     and not public.is_privileged_session() then
    raise exception 'user_id and verification_status cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger vendors_guard_write
  before insert or update on public.vendors
  for each row execute function public.vendors_guard_write();

-------------------------------------------------------------------------------
-- Row Level Security (no policy = deny)
-------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Vendor business details are visible to signed-in users (004 service areas, 006 quote display).
create policy vendors_select_authenticated on public.vendors
  for select to authenticated
  using (true);

create policy vendors_update_own on public.vendors
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No INSERT or DELETE policies: rows are created by handle_new_user() and removed by cascade.
revoke insert, delete on public.profiles from anon, authenticated;
revoke insert, delete on public.vendors from anon, authenticated;
revoke all on public.profiles from anon;
revoke all on public.vendors from anon;
