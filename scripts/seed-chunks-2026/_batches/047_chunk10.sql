insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  'a6267500-0000-4000-8000-00000000004b', 'AST-2026-0075', '11111111-1111-1111-1111-111111111108', 'Remote', 'desktop',
  'HP', 'Catalyst 9200', 'SN26000075', '2025-06-12',
  '2027-06-12', 'Shared Pool', 'Windows 11 Pro', 'Active', 'In Use',
  650, 420, true, false, false, false, false, false, 1,
  70, 'Online', 'Up to date', 'Protected',
  'Managed endpoint under Nexus RMM coverage.'
);

insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  'a6267500-0000-4000-8000-00000000004c', 'AST-2026-0076', '11111111-1111-1111-1111-111111111108', 'HQ', 'server',
  'Lenovo', 'Latitude 5440', 'SN26000076', '2024-07-12',
  '2027-07-12', 'Ops Desk', 'Windows Server 2022', 'Active', 'In Use',
  1299, 900, true, false, false, false, false, false, 1,
  77, 'Online', 'Up to date', 'Protected',
  'Managed endpoint under Nexus RMM coverage.'
);

insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  'a6267500-0000-4000-8000-00000000004d', 'AST-2026-0077', '11111111-1111-1111-1111-111111111108', 'Warehouse', 'switch',
  'Apple', 'EliteBook 840', 'SN26000077', '2025-08-12',
  '2027-08-12', 'Executive', 'ChromeOS', 'Active', 'In Use',
  899, 650, true, false, false, false, false, false, 1,
  84, 'Online', 'Up to date', 'Protected',
  'Managed endpoint under Nexus RMM coverage.'
);

insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  'a6267500-0000-4000-8000-00000000004e', 'AST-2026-0078', '11111111-1111-1111-1111-111111111108', 'Clinic Floor', 'mobile',
  'Cisco', 'ThinkPad T14', 'SN26000078', '2024-09-12',
  '2027-09-12', 'Taylor Green', 'Windows 11 Pro', 'Active', 'In Use',
  2499, 1800, true, false, false, false, false, false, 1,
  91, 'Online', 'Up to date', 'Protected',
  'Managed endpoint under Nexus RMM coverage.'
);

insert into public.hardware_assets (
  id, asset_number, customer_id, location, category, manufacturer, model, serial_number,
  purchase_date, warranty_expiration, assigned_employee, operating_system, device_status,
  lifecycle_stage, purchase_cost, current_value, managed_coverage, warranty_expiring_soon,
  nearing_eol, needs_replacement, unsupported_os, missing_security_updates, quantity,
  health_score, online_status, patch_status, antivirus_status, notes
) values (
  'a6267500-0000-4000-8000-00000000004f', 'AST-2026-0079', '11111111-1111-1111-1111-111111111108', 'Branch Office', 'laptop',
  'Dell', 'MacBook Pro 14', 'SN26000079', '2025-10-12',
  '2027-10-12', 'Shared Pool', 'macOS Sonoma', 'Active', 'In Use',
  1899, 1400, true, false, false, false, false, false, 1,
  70, 'Online', 'Up to date', 'Protected',
  'Managed endpoint under Nexus RMM coverage.'
);

-- Ticket expenses (17)
insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000001', 'a6267100-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333303', 'Meals', 24, '2026-01-05',
  'On-site support expense — Northwind Manufacturing', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000002', 'a6267100-0000-4000-8000-000000000006', '33333333-3333-3333-3333-333333333309', 'Parking', 42.75, '2026-01-05',
  'On-site support expense — Northwind Manufacturing', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000003', 'a6267100-0000-4000-8000-000000000019', '33333333-3333-3333-3333-333333333308', 'Travel', 12, '2026-05-04',
  'On-site support expense — Northwind Manufacturing', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000004', 'a6267100-0000-4000-8000-00000000001f', '33333333-3333-3333-3333-333333333306', 'Meals', 18.5, '2026-06-03',
  'On-site support expense — Northwind Manufacturing', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000005', 'a6267100-0000-4000-8000-000000000024', '33333333-3333-3333-3333-333333333303', 'Parking', 24, '2026-06-03',
  'On-site support expense — Northwind Manufacturing', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000006', 'a6267100-0000-4000-8000-000000000050', '33333333-3333-3333-3333-333333333305', 'Travel', 42.75, '2026-03-04',
  'On-site support expense — Beacon Legal Group', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000007', 'a6267100-0000-4000-8000-000000000078', '33333333-3333-3333-3333-333333333308', 'Meals', 12, '2026-04-06',
  'On-site support expense — Harbor Retail Collective', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000008', 'a6267100-0000-4000-8000-000000000097', '33333333-3333-3333-3333-333333333305', 'Parking', 18.5, '2026-02-06',
  'On-site support expense — Summit Family Clinics', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000009', 'a6267100-0000-4000-8000-00000000009d', '33333333-3333-3333-3333-333333333305', 'Travel', 24, '2026-04-06',
  'On-site support expense — Summit Family Clinics', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000a', 'a6267100-0000-4000-8000-0000000000a6', '33333333-3333-3333-3333-333333333301', 'Meals', 42.75, '2026-07-06',
  'On-site support expense — Summit Family Clinics', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000b', 'a6267100-0000-4000-8000-0000000000bf', '33333333-3333-3333-3333-333333333308', 'Parking', 12, '2026-03-09',
  'On-site support expense — Cedar County Schools', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000c', 'a6267100-0000-4000-8000-0000000000e7', '33333333-3333-3333-3333-333333333301', 'Travel', 18.5, '2026-04-08',
  'On-site support expense — PixelCraft Studio', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000d', 'a6267100-0000-4000-8000-000000000102', '33333333-3333-3333-3333-333333333302', 'Meals', 24, '2026-01-09',
  'On-site support expense — Lakeside Logistics', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000e', 'a6267100-0000-4000-8000-000000000111', '33333333-3333-3333-3333-333333333306', 'Parking', 42.75, '2026-06-09',
  'On-site support expense — Lakeside Logistics', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-00000000000f', 'a6267100-0000-4000-8000-000000000127', '33333333-3333-3333-3333-333333333309', 'Travel', 12, '2026-01-12',
  'On-site support expense — Greenfield Credit Union', 'Internal Company Expense', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000010', 'a6267100-0000-4000-8000-000000000130', '33333333-3333-3333-3333-333333333304', 'Meals', 18.5, '2026-04-10',
  'On-site support expense — Greenfield Credit Union', 'Billable to Customer', 'Approved'
);

insert into public.ticket_expenses (
  id, ticket_id, technician_id, type, amount, date, description, expense_tag, approval_status
) values (
  'a6267600-0000-4000-8000-000000000011', 'a6267100-0000-4000-8000-000000000136', '33333333-3333-3333-3333-333333333304', 'Parking', 24, '2026-06-10',
  'On-site support expense — Greenfield Credit Union', 'Internal Company Expense', 'Approved'
);

-- Security scores (32)
insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111101', 83, 'Healthy', 79, 73,
  73, 76, 83, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111101', 84, 'Healthy', 80, 74,
  74, 77, 86, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111101', 85, 'Healthy', 81, 75,
  75, 78, 89, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111101', 86, 'Healthy', 82, 76,
  76, 79, 92, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111102', 79, 'Healthy', 80, 75,
  75, 79, 84, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111102', 80, 'Healthy', 81, 76,
  76, 80, 87, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111102', 81, 'Healthy', 82, 77,
  77, 81, 90, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000008', '11111111-1111-1111-1111-111111111102', 82, 'Healthy', 83, 78,
  78, 82, 93, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111103', 75, 'Healthy', 81, 77,
  77, 82, 85, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000a', '11111111-1111-1111-1111-111111111103', 76, 'Healthy', 82, 78,
  78, 83, 88, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000b', '11111111-1111-1111-1111-111111111103', 77, 'Healthy', 83, 79,
  79, 84, 91, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000c', '11111111-1111-1111-1111-111111111103', 78, 'Healthy', 84, 80,
  80, 85, 94, '2026-12-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000d', '11111111-1111-1111-1111-111111111104', 85, 'Healthy', 82, 79,
  79, 85, 86, '2026-03-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000e', '11111111-1111-1111-1111-111111111104', 86, 'Healthy', 83, 80,
  80, 86, 89, '2026-06-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

insert into public.security_scores (
  id, customer_id, health_score, firewall_status, endpoint_coverage_pct, antivirus_current_pct,
  patch_compliance_pct, encryption_coverage_pct, mfa_adoption_pct, last_assessed_at, notes
) values (
  'a6267800-0000-4000-8000-00000000000f', '11111111-1111-1111-1111-111111111104', 87, 'Healthy', 84, 81,
  81, 87, 92, '2026-09-28', 'Quarterly MSP security posture review'
)
on conflict (id) do nothing;

