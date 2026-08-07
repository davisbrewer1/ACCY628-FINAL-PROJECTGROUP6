-- Service tickets (331)
insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000001', 'TKT-2026-0001', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Laptop imaging and join to Entra ID — Northwind',
  'Hardware Deployment request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Deployment', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333303', '2026-01-05T09:05:00-05:00', '2026-01-05T12:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-05T09:00:00-05:00', 'h09x3',
  4, 4, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000002', 'TKT-2026-0002', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'M365 mailbox restore request — Northwind',
  'Microsoft 365 request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Microsoft 365', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-01-07T11:05:00-05:00', '2026-01-07T13:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-07T11:00:00-05:00', 'h11',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000003', 'TKT-2026-0003', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Patch cycle review and reboot window — Northwind',
  'Software Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333305', '2026-01-12T13:05:00-05:00', '2026-01-12T15:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-12T13:00:00-05:00', 'h13',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000004', 'TKT-2026-0004', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Firewall rule change for vendor access — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333306', '2026-01-15T15:05:00-05:00', '2026-01-15T17:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-15T15:00:00-05:00', 'h15',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000005', 'TKT-2026-0005', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Endpoint AV quarantine investigation — Northwind',
  'Cybersecurity request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cybersecurity', 'Critical', 'Remote',
  '33333333-3333-3333-3333-333333333308', '2026-01-19T09:05:00-05:00', '2026-01-19T12:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-19T09:00:00-05:00', 'h09x3',
  4, 4, false, false, false, true,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000006', 'TKT-2026-0006', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Printer mapping and driver cleanup — Northwind',
  'Hardware Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Support', 'Low', 'On-site',
  '33333333-3333-3333-3333-333333333309', '2026-01-05T11:05:00-05:00', '2026-01-05T13:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-01-05T11:00:00-05:00', 'h11',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000007', 'TKT-2026-0007', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Shared drive permissions update — Northwind',
  'Software Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333302', '2026-02-03T15:05:00-05:00', '2026-02-03T16:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-03T15:00:00-05:00', 'h15',
  2, 2, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000008', 'TKT-2026-0008', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Wi-Fi dead spot survey — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333303', '2026-02-09T09:05:00-05:00', '2026-02-09T13:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-09T09:00:00-05:00', 'h09x3',
  5, 5, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000009', 'TKT-2026-0009', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Backup job failure triage — Northwind',
  'Cloud request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-02-11T11:05:00-05:00', '2026-02-11T14:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-11T11:00:00-05:00', 'h11',
  4, 4, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-00000000000a', 'TKT-2026-0010', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'New hire workstation setup — Northwind',
  'Hardware Deployment request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Deployment', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333305', '2026-02-16T13:05:00-05:00', '2026-02-16T15:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-16T13:00:00-05:00', 'h13',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-00000000000b', 'TKT-2026-0011', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Phishing report triage — Northwind',
  'Cybersecurity request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cybersecurity', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333306', '2026-02-19T15:05:00-05:00', '2026-02-19T17:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-19T15:00:00-05:00', 'h15',
  3, 3, false, false, false, true,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-00000000000c', 'TKT-2026-0012', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Server disk capacity expansion — Northwind',
  'Cloud request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333308', '2026-02-03T09:05:00-05:00', '2026-02-03T12:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-02-03T09:00:00-05:00', 'h09x3',
  4, 4, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-00000000000d', 'TKT-2026-0013', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'QoS tuning for VoIP quality — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333301', '2026-03-03T13:05:00-05:00', '2026-03-03T15:20:00-05:00',
  'Completed', 'Casey Plant', 'clientuser@nexus.demo',
  'Resolved for Casey Plant. Changes documented and validated with end users.', '2026-03-03T13:00:00-05:00', 'h13',
  3, 3, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

