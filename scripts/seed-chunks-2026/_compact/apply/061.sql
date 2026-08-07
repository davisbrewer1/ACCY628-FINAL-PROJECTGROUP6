insert into public.announcements (title, body, audience, active)
select
  '2026 service year underway',
  'Your Nexus managed services agreement covers recurring support hours, patching, and backup monitoring. Review Billing for paid invoices and open tickets from the portal home.',
  'clients',
  true
where not exists (
  select 1 from public.announcements where title = '2026 service year underway'
);
