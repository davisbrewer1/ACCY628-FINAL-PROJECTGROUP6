insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values
(
  'a6267800-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111102', 80, 'Healthy', 81, 76,
  76, 80, 87, '2026-06-28', 'Quarterly MSP security posture review'
),
(id);
