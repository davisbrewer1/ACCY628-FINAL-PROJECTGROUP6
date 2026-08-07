insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000004b', 'a6267100-0000-4000-8000-000000000079', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333309',
  '2026-04-09', '10:00', '11:00', 1,
  'Completed shared drive permissions update for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 56, 56, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000004c', 'a6267100-0000-4000-8000-00000000007a', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333301',
  '2026-04-13', '12:00', '16:00', 3.5,
  'Completed wi-fi dead spot survey for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'On-site',
  0, 0, 0, 35, 0, 168, 203, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000004d', 'a6267100-0000-4000-8000-00000000007b', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333303',
  '2026-05-05', '11:00', '14:00', 2.5,
  'Completed backup job failure triage for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 145, 145, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000004e', 'a6267100-0000-4000-8000-00000000007c', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333304',
  '2026-05-11', '13:00', '15:00', 2,
  'Completed new hire workstation setup for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'On-site',
  0, 0, 0, 35, 0, 84, 119, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000004f', 'a6267100-0000-4000-8000-00000000007d', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333305',
  '2026-05-13', '15:00', '17:00', 1.5,
  'Completed phishing report triage for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 90, 90, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000050', 'a6267100-0000-4000-8000-00000000007e', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333308',
  '2026-06-05', '14:00', '17:00', 4.5,
  'Completed server disk capacity expansion for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 288, 288, false,
  false, 'Approved', 'Billed',
  'a6267300-0000-4000-8000-000000000062', '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000051', 'a6267100-0000-4000-8000-00000000007f', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333309',
  '2026-06-09', '08:00', '10:00', 2,
  'Completed qos tuning for voip quality for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 112, 112, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000052', 'a6267100-0000-4000-8000-000000000080', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333301',
  '2026-06-15', '10:00', '11:00', 1,
  'Completed application licensing renewal assist for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 48, 48, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000053', 'a6267100-0000-4000-8000-000000000081', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333303',
  '2026-07-06', '09:00', '12:00', 2.5,
  'Completed vpn dropouts for remote staff for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 145, 145, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000054', 'a6267100-0000-4000-8000-000000000082', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333304',
  '2026-07-09', '11:00', '14:00', 3,
  'Completed laptop imaging and join to entra id for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'On-site',
  0, 0, 0, 35, 0, 126, 161, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000055', 'a6267100-0000-4000-8000-000000000083', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', '33333333-3333-3333-3333-333333333305',
  '2026-07-13', '13:00', '15:00', 2,
  'Completed m365 mailbox restore request for Harbor Retail Collective.', 'Closed with customer confirmation from Sam Harbor.', 'Remote',
  0, 0, 0, 0, 0, 120, 120, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000056', 'a6267100-0000-4000-8000-000000000094', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333301',
  '2026-01-06', '12:00', '13:00', 1,
  'Completed shared drive permissions update for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 48, 48, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000057', 'a6267100-0000-4000-8000-000000000095', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333302',
  '2026-01-12', '14:00', '17:00', 3.5,
  'Completed wi-fi dead spot survey for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'On-site',
  0, 0, 0, 35, 0, 192.5, 227.5, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000058', 'a6267100-0000-4000-8000-000000000096', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333303',
  '2026-01-14', '08:00', '11:00', 2.5,
  'Completed backup job failure triage for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 145, 145, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-000000000059', 'a6267100-0000-4000-8000-000000000097', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333305',
  '2026-02-06', '15:00', '17:00', 2,
  'Completed new hire workstation setup for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'On-site',
  89.5, 0, 0, 35, 0, 120, 244.5, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000005a', 'a6267100-0000-4000-8000-000000000098', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333306',
  '2026-02-10', '09:00', '11:00', 1.5,
  'Completed phishing report triage for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 93, 93, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000005b', 'a6267100-0000-4000-8000-000000000099', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333308',
  '2026-02-16', '11:00', '14:00', 3,
  'Completed server disk capacity expansion for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 192, 192, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000005c', 'a6267100-0000-4000-8000-00000000009a', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333301',
  '2026-03-06', '10:00', '12:00', 2,
  'Completed qos tuning for voip quality for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 96, 96, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000005d', 'a6267100-0000-4000-8000-00000000009b', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333302',
  '2026-03-10', '12:00', '13:00', 1,
  'Completed application licensing renewal assist for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 55, 55, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

insert into public.work_entries (
  id, ticket_id, customer_id, contract_id, technician_id, work_date, start_time, end_time,
  hours_worked, work_performed, resolution_notes, service_method, parts_cost, software_cost,
  equipment_cost, travel_cost, other_cost, labor_cost, total_direct_cost, included_in_contract,
  additional_approval_required, approval_status, billing_status, invoice_id, parts_used
) values (
  'a6267200-0000-4000-8000-00000000005e', 'a6267100-0000-4000-8000-00000000009c', '11111111-1111-1111-1111-111111111104', 'a6267700-0000-4000-8000-000000000004', '33333333-3333-3333-3333-333333333303',
  '2026-03-16', '14:00', '17:00', 2.5,
  'Completed vpn dropouts for remote staff for Summit Family Clinics.', 'Closed with customer confirmation from Dr. Riley Summit.', 'Remote',
  0, 0, 0, 0, 0, 145, 145, true,
  false, 'Approved', 'Not Billable',
  null, '[]'::jsonb
);

