insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values
(
  'a6267800-0000-4000-8000-00000000001f', '11111111-1111-1111-1111-111111111108', 90, 'Healthy', 88, 89,
  89, 79, 80, '2026-09-28', 'Quarterly MSP security posture review'
),
(id);
