-- 002 Household Solar Request
-- Owns: household_requests, its guard triggers and RLS, and the private roof-photos bucket.
-- Spec: specs/002-household-solar-request/data-model.md

-------------------------------------------------------------------------------
-- household_requests
-------------------------------------------------------------------------------

create table public.household_requests (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  address_text           text null check (address_text is null or char_length(btrim(address_text)) between 5 and 300),
  latitude               numeric(9, 6) null check (latitude between -90 and 90),
  longitude              numeric(9, 6) null check (longitude between -180 and 180),
  locality               text null check (locality is null or char_length(btrim(locality)) between 2 and 100),
  monthly_units          integer null check (monthly_units between 1 and 10000),
  monthly_bill           integer null check (monthly_bill between 0 and 100000),
  budget                 integer null check (budget between 10000 and 5000000),
  preferred_capacity_kw  numeric(4, 1) null check (preferred_capacity_kw between 0.5 and 20),
  roof_photo_path        text null,
  ai_consent             boolean not null default false,
  status                 text not null default 'draft' check (status in ('draft', 'open', 'quoted', 'accepted', 'closed')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint household_requests_roof_photo_path_chk
    check (roof_photo_path is null or roof_photo_path like user_id::text || '/' || id::text || '/%'),
  constraint household_requests_location_pair_chk check ((latitude is null) = (longitude is null)),
  constraint household_requests_publish_complete_chk check (
    status = 'draft'
    or (latitude is not null and longitude is not null and address_text is not null and locality is not null
        and monthly_units is not null and budget is not null and roof_photo_path is not null)
  )
);

comment on table public.household_requests is 'Household solar requests. Only drafts are editable; see guard triggers.';

create index household_requests_user_created_idx on public.household_requests (user_id, created_at desc);
create index household_requests_status_idx on public.household_requests (status);

create trigger household_requests_set_updated_at
  before update on public.household_requests
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Guard triggers
-------------------------------------------------------------------------------

create or replace function public.household_requests_guard_insert()
returns trigger
language plpgsql
as $$
begin
  if not public.is_privileged_session() then
    if new.status <> 'draft' then
      raise exception 'requests must start as drafts' using errcode = '23514';
    end if;
    if new.roof_photo_path is not null then
      raise exception 'roof photo cannot be set on insert' using errcode = '23514';
    end if;
    if new.user_id is distinct from auth.uid() or public.current_user_role() is distinct from 'household' then
      raise exception 'only households can create their own requests' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger household_requests_guard_insert
  before insert on public.household_requests
  for each row execute function public.household_requests_guard_insert();

create or replace function public.household_requests_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'id, user_id and created_at cannot be changed' using errcode = '23514';
  end if;

  if new.status is distinct from old.status
     and not ((old.status, new.status) in (
       ('draft', 'open'), ('open', 'quoted'), ('open', 'accepted'), ('quoted', 'accepted'), ('accepted', 'closed')
     )) then
    raise exception 'invalid status transition' using errcode = '23514';
  end if;

  if not public.is_privileged_session() then
    if old.status = 'draft' then
      if new.status not in ('draft', 'open') then
        raise exception 'drafts can only be published' using errcode = '23514';
      end if;
    else
      if new.status is distinct from old.status then
        raise exception 'status cannot be changed by the owner' using errcode = '23514';
      end if;
      if (to_jsonb(new) - 'ai_consent' - 'updated_at') is distinct from (to_jsonb(old) - 'ai_consent' - 'updated_at') then
        raise exception 'published requests are read-only' using errcode = '23514';
      end if;
      if new.ai_consent and not old.ai_consent then
        raise exception 'consent can only be given before publishing' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger household_requests_guard_update
  before update on public.household_requests
  for each row execute function public.household_requests_guard_update();

-------------------------------------------------------------------------------
-- Row Level Security (no policy = deny; no DELETE, no vendor access here)
-------------------------------------------------------------------------------

alter table public.household_requests enable row level security;

create policy household_requests_select_own on public.household_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy household_requests_insert_own on public.household_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_role() = 'household'
    and status = 'draft'
    and roof_photo_path is null
  );

create policy household_requests_update_own on public.household_requests
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- Private roof-photos bucket
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roof-photos', 'roof-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy roof_photos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'roof-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy roof_photos_owner_insert_draft on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'roof-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.household_requests r
      where r.id::text = (storage.foldername(name))[2]
        and r.user_id = (select auth.uid())
        and r.status = 'draft'
    )
  );

create policy roof_photos_owner_delete_draft on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'roof-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.household_requests r
      where r.id::text = (storage.foldername(name))[2]
        and r.user_id = (select auth.uid())
        and r.status = 'draft'
    )
  );
