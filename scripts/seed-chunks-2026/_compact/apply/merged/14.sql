insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000017', '11111111-1111-1111-1111-111111111106', 79, 'Healthy', 86, 85,
  85, 93, 94, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000018', '11111111-1111-1111-1111-111111111106', 80, 'Healthy', 87, 86,
  86, 94, 81, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000019', '11111111-1111-1111-1111-111111111107', 73, 'Healthy', 85, 85,
  85, 94, 89, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001a', '11111111-1111-1111-1111-111111111107', 74, 'Healthy', 86, 86,
  86, 75, 92, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001b', '11111111-1111-1111-1111-111111111107', 75, 'Healthy', 87, 87,
  87, 76, 95, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001c', '11111111-1111-1111-1111-111111111107', 76, 'Healthy', 88, 88,
  88, 77, 82, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001d', '11111111-1111-1111-1111-111111111108', 88, 'Healthy', 86, 87,
  87, 77, 90, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001e', '11111111-1111-1111-1111-111111111108', 89, 'Healthy', 87, 88,
  88, 78, 93, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000001f', '11111111-1111-1111-1111-111111111108', 90, 'Healthy', 88, 89,
  89, 79, 80, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000020', '11111111-1111-1111-1111-111111111108', 91, 'Healthy', 89, 72,
  72, 80, 83, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.announcements (title, body, audience, active)
select
  '2026 service year underway',
  'Your Nexus managed services agreement covers recurring support hours, patching, and backup monitoring. Review Billing for paid invoices and open tickets from the portal home.',
  'clients',
  true
where not exists (
  select 1 from public.announcements where title = '2026 service year underway'
);
