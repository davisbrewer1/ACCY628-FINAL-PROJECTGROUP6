-- UI Configuration: which landing-page services are publicly offered.
-- Also gates client portal ticket categories/subcategories.

insert into public.app_settings (key, value, updated_at)
values (
  'landing_services_enabled',
  '[
    "Hardware Procurement & Lifecycle",
    "Software & Cloud Management",
    "Managed IT Support",
    "Cybersecurity Monitoring",
    "AI Governance",
    "Deployment & Retirement"
  ]'::jsonb,
  now()
)
on conflict (key) do nothing;

-- Anonymous visitors need to read this one setting for the marketing page.
drop policy if exists "Public can read landing services setting" on public.app_settings;
create policy "Public can read landing services setting"
  on public.app_settings
  for select
  to anon, authenticated
  using (key = 'landing_services_enabled');
