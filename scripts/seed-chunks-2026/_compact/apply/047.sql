insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values
(
  'a6267800-0000-4000-8000-000000000013', '11111111-1111-1111-1111-111111111105', 73, 'Healthy', 85, 83,
  83, 90, 93, '2026-09-28', 'Quarterly MSP security posture review'
),
(id);
