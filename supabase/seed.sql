-- SURYAMIT demo seed. Applied by `npm run db:reset` (supabase db reset).
-- All people, vendors and data below are FICTIONAL and labelled "Demo" in the UI.
-- Sections are appended in feature order; keep each feature inside its own section.

-------------------------------------------------------------------------------
-- 001 — demo accounts (research.md R-10)
-- Password for all four accounts must equal DEMO_ACCOUNT_PASSWORD in .env.local.
-------------------------------------------------------------------------------

do $$
declare
  demo_password constant text := 'suryamit-demo-2026';
  accounts jsonb := '[
    {"id":"d0000000-0000-4000-8000-000000000001","email":"demo-household@example.com",
     "meta":{"role":"household","name":"Sharma Residence","phone":"+919000000001"}},
    {"id":"d0000000-0000-4000-8000-000000000011","email":"demo-sunrise@example.com",
     "meta":{"role":"vendor","name":"SunRise Energy","phone":"+919000000011",
             "company_name":"SunRise Energy","service_area":"Hyderabad, Telangana"}},
    {"id":"d0000000-0000-4000-8000-000000000012","email":"demo-greenvolt@example.com",
     "meta":{"role":"vendor","name":"GreenVolt Solar","phone":"+919000000012",
             "company_name":"GreenVolt Solar","service_area":"Hyderabad, Telangana"}},
    {"id":"d0000000-0000-4000-8000-000000000013","email":"demo-solartech@example.com",
     "meta":{"role":"vendor","name":"SolarTech Solutions","phone":"+919000000013",
             "company_name":"SolarTech Solutions","service_area":"Hyderabad, Telangana"}}
  ]'::jsonb;
  acc jsonb;
begin
  for acc in select * from jsonb_array_elements(accounts) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', (acc ->> 'id')::uuid, 'authenticated', 'authenticated',
      acc ->> 'email', extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, acc -> 'meta', now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      (acc ->> 'id')::uuid, (acc ->> 'id')::uuid, acc ->> 'id',
      jsonb_build_object('sub', acc ->> 'id', 'email', acc ->> 'email', 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

-- handle_new_user() created the profiles/vendors; mark them as demo (privileged seed session).
update public.profiles set is_demo = true
where id in (
  'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000011',
  'd0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000013'
);

-- Fixed vendor ids so later sections (005 quotes) can reference them.
update public.vendors v set
  id = x.vendor_id::uuid,
  verification_status = 'demo',
  latitude = x.lat,
  longitude = x.lng,
  service_radius_km = x.radius
from (values
  ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000111', 17.448300, 78.391500, 30),
  ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000112', 17.439900, 78.498300, 25),
  ('d0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000113', 17.440100, 78.348900, 40)
) as x(user_id, vendor_id, lat, lng, radius)
where v.user_id = x.user_id::uuid;

-------------------------------------------------------------------------------
-- 002 — household requests (Sharma Residence demo request)
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 003 — solar financial engine
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 004 — vendor request discovery
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 005 — vendor quotes
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 006 — quote comparison and scoring
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 007 — quote acceptance
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 008 — roof assessments
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 009 — quote extraction and injection demo
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 010 — voice requirement entry
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- 011 — AI solar advisor
-------------------------------------------------------------------------------
