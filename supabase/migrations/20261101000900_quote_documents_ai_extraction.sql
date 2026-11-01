-- 009 Quote extraction and prompt-injection defense
-- Adds (never alters 005/002 objects): private quote-documents bucket + storage policies,
-- the ai_extracted => source_document_path check, and a submit_quote overload that records
-- source / source_document_path. Spec: specs/009-quote-extraction-injection-defense/data-model.md

-------------------------------------------------------------------------------
-- Private bucket (idempotent)
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-documents', 'quote-documents', false, 5242880,
        array['image/jpeg', 'image/png', 'application/pdf', 'text/plain'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];

-- Object name: {vendor_user_id}/{upload_id}/source.{jpg|png|pdf|txt}. No UPDATE / DELETE policies.

create policy quote_documents_009_vendor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quote-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_role() = 'vendor'
  );

create policy quote_documents_009_vendor_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quote-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy quote_documents_009_household_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quote-documents'
    and exists (
      select 1
      from public.quotes q
      join public.household_requests r on r.id = q.request_id
      where q.source_document_path = storage.objects.name
        and r.user_id = (select auth.uid())
    )
  );

-------------------------------------------------------------------------------
-- quotes: AI-extracted quotes must reference a stored source document
-------------------------------------------------------------------------------

alter table public.quotes
  add constraint quotes_ai_extracted_requires_document
  check (source <> 'ai_extracted' or source_document_path is not null);

-------------------------------------------------------------------------------
-- submit_quote overload with source + source_document_path
-- (the 12-argument 005 function stays and always stores 'manual')
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
  p_vendor_notes text,
  p_source text,
  p_source_document_path text
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

  if p_source not in ('manual', 'ai_extracted') then
    raise exception 'INVALID_SOURCE' using errcode = '23514';
  end if;
  if p_source = 'ai_extracted' then
    -- The document must live in the submitting vendor's own folder.
    if p_source_document_path is null
       or split_part(p_source_document_path, '/', 1) <> auth.uid()::text then
      raise exception 'SOURCE_DOCUMENT_NOT_OWNED' using errcode = '42501';
    end if;
  elsif p_source_document_path is not null then
    raise exception 'INVALID_SOURCE' using errcode = '23514';
  end if;

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
    exclusions, vendor_notes, source, source_document_path, status
  ) values (
    p_request_id, v_vendor_id, p_price, p_capacity_kw,
    coalesce(p_panel_details, '{}'::jsonb), coalesce(p_inverter_details, '{}'::jsonb),
    coalesce(p_warranty_details, '{}'::jsonb),
    p_installation_days, p_earthing_included, p_documentation_included,
    coalesce(p_other_inclusions, '[]'::jsonb), p_exclusions, p_vendor_notes,
    p_source, p_source_document_path, 'submitted'
  ) returning * into v_quote;

  update public.household_requests set status = 'quoted' where id = p_request_id and status = 'open';

  return v_quote;
end;
$$;

revoke all on function public.submit_quote(uuid, integer, numeric, jsonb, jsonb, jsonb, integer, boolean, boolean, jsonb, text, text, text, text) from public, anon;
grant execute on function public.submit_quote(uuid, integer, numeric, jsonb, jsonb, jsonb, integer, boolean, boolean, jsonb, text, text, text, text) to authenticated;
