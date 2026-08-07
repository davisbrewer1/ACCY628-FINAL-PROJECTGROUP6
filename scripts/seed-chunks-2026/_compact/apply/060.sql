insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values
(
  'a6267800-0000-4000-8000-000000000020', '11111111-1111-1111-1111-111111111108', 91, 'Healthy', 89, 72,
  72, 80, 83, '2026-12-28', 'Quarterly MSP security posture review'
),
(id);
