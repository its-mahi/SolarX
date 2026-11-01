-- 004 Vendor Request Discovery
-- Adds read-only, privacy-safe projections for vendors. Creates no tables.
-- Deliberately NO vendor RLS policy on household_requests, roof_assessments or storage.objects
-- (research R1): vendors read only through the SECURITY DEFINER functions below, which expose
-- approximate coordinates and omit address, name, phone, monthly bill and the photo path.
-- Spec: specs/004-vendor-request-discovery/data-model.md

create index if not exists household_requests_status_idx on public.household_requests (status);

-------------------------------------------------------------------------------
-- vendor_list_open_requests()
-------------------------------------------------------------------------------
create or replace function public.vendor_list_open_requests()
returns table (
  id uuid,
  status text,
  locality text,
  approx_latitude numeric,
  approx_longitude numeric,
  monthly_units integer,
  budget integer,
  preferred_capacity_kw numeric,
  has_roof_photo boolean,
  is_demo boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'vendor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select hr.id, hr.status::text, hr.locality,
         round(hr.latitude::numeric, 2), round(hr.longitude::numeric, 2),
         hr.monthly_units, hr.budget, hr.preferred_capacity_kw::numeric,
         (hr.roof_photo_path is not null), p.is_demo, hr.created_at
  from public.household_requests hr
  join public.profiles p on p.id = hr.user_id
  where hr.status in ('open', 'quoted')
  order by hr.created_at desc;
end;
$$;

-------------------------------------------------------------------------------
-- vendor_get_open_request(p_request_id)
-------------------------------------------------------------------------------
create or replace function public.vendor_get_open_request(p_request_id uuid)
returns table (
  id uuid,
  status text,
  locality text,
  approx_latitude numeric,
  approx_longitude numeric,
  monthly_units integer,
  budget integer,
  preferred_capacity_kw numeric,
  has_roof_photo boolean,
  is_demo boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'vendor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select hr.id, hr.status::text, hr.locality,
         round(hr.latitude::numeric, 2), round(hr.longitude::numeric, 2),
         hr.monthly_units, hr.budget, hr.preferred_capacity_kw::numeric,
         (hr.roof_photo_path is not null), p.is_demo, hr.created_at
  from public.household_requests hr
  join public.profiles p on p.id = hr.user_id
  where hr.id = p_request_id and hr.status in ('open', 'quoted');
end;
$$;

-------------------------------------------------------------------------------
-- vendor_get_latest_roof_assessment(p_request_id)
-- Works today (roof_assessments does not exist yet: returns no rows) and keeps working once
-- feature 008 creates the table. Dynamic SQL so this migration applies without the table.
-------------------------------------------------------------------------------
create or replace function public.vendor_get_latest_roof_assessment(p_request_id uuid)
returns table (
  observations jsonb,
  potential_obstructions jsonb,
  limitations jsonb,
  site_survey_required boolean,
  assessed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'vendor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if to_regclass('public.roof_assessments') is null then
    return;
  end if;

  return query execute
    'select to_jsonb(ra.observations), to_jsonb(ra.potential_obstructions), to_jsonb(ra.limitations),
            ra.site_survey_required, ra.created_at
       from public.roof_assessments ra
      where ra.request_id = $1 and ra.status = ''completed''
        and exists (select 1 from public.household_requests hr
                     where hr.id = ra.request_id and hr.status in (''open'', ''quoted''))
      order by ra.created_at desc
      limit 1'
    using p_request_id;
end;
$$;

revoke all on function public.vendor_list_open_requests() from public, anon;
revoke all on function public.vendor_get_open_request(uuid) from public, anon;
revoke all on function public.vendor_get_latest_roof_assessment(uuid) from public, anon;
grant execute on function public.vendor_list_open_requests() to authenticated;
grant execute on function public.vendor_get_open_request(uuid) to authenticated;
grant execute on function public.vendor_get_latest_roof_assessment(uuid) to authenticated;
