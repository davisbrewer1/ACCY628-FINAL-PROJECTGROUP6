insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000036', 'TKT-2026-0054', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Backup job failure triage — Northwind',
  'Cloud request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333309', '2026-09-21T10:05:00-05:00', null,
  'Assigned', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-09-21T10:00:00-05:00', 'h10',
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
  'a6267100-0000-4000-8000-000000000037', 'TKT-2026-0055', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'New hire workstation setup — Northwind',
  'Hardware Deployment request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Deployment', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333301', '2026-09-03T12:05:00-05:00', null,
  'In Progress', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-09-03T12:00:00-05:00', 'h12',
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
  'a6267100-0000-4000-8000-000000000038', 'TKT-2026-0056', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Phishing report triage — Northwind',
  'Cybersecurity request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cybersecurity', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333303', '2026-10-05T08:05:00-05:00', null,
  'New', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-05T08:00:00-05:00', 'h08',
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
  'a6267100-0000-4000-8000-000000000039', 'TKT-2026-0057', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Server disk capacity expansion — Northwind',
  'Cloud request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-10-07T10:05:00-05:00', null,
  'Assigned', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-07T10:00:00-05:00', 'h10x3',
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
  'a6267100-0000-4000-8000-00000000003a', 'TKT-2026-0058', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'QoS tuning for VoIP quality — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333305', '2026-10-12T12:05:00-05:00', null,
  'In Progress', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-12T12:00:00-05:00', 'h12',
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
  'a6267100-0000-4000-8000-00000000003b', 'TKT-2026-0059', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Application licensing renewal assist — Northwind',
  'Software Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Software Support', 'Low', 'Remote',
  '33333333-3333-3333-3333-333333333306', '2026-10-15T14:05:00-05:00', null,
  'New', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-15T14:00:00-05:00', 'h14',
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
  'a6267100-0000-4000-8000-00000000003c', 'TKT-2026-0060', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'VPN dropouts for remote staff — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333308', '2026-10-19T08:05:00-05:00', null,
  'Assigned', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-19T08:00:00-05:00', 'h08',
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
  'a6267100-0000-4000-8000-00000000003d', 'TKT-2026-0061', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Laptop imaging and join to Entra ID — Northwind',
  'Hardware Deployment request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Deployment', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333309', '2026-10-05T10:05:00-05:00', null,
  'In Progress', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-10-05T10:00:00-05:00', 'h10x3',
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
  'a6267100-0000-4000-8000-00000000003e', 'TKT-2026-0062', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'M365 mailbox restore request — Northwind',
  'Microsoft 365 request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Microsoft 365', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333302', '2026-11-03T14:05:00-05:00', null,
  'New', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-03T14:00:00-05:00', 'h14',
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
  'a6267100-0000-4000-8000-00000000003f', 'TKT-2026-0063', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Patch cycle review and reboot window — Northwind',
  'Software Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333303', '2026-11-09T08:05:00-05:00', null,
  'Assigned', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-09T08:00:00-05:00', 'h08',
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
  'a6267100-0000-4000-8000-000000000040', 'TKT-2026-0064', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Firewall rule change for vendor access — Northwind',
  'Network request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Network', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-11-11T10:05:00-05:00', null,
  'In Progress', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-11T10:00:00-05:00', 'h10',
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
  'a6267100-0000-4000-8000-000000000041', 'TKT-2026-0065', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Endpoint AV quarantine investigation — Northwind',
  'Cybersecurity request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Cybersecurity', 'Critical', 'Remote',
  '33333333-3333-3333-3333-333333333305', '2026-11-16T12:05:00-05:00', null,
  'New', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-16T12:00:00-05:00', 'h12x3',
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
  'a6267100-0000-4000-8000-000000000042', 'TKT-2026-0066', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Printer mapping and driver cleanup — Northwind',
  'Hardware Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Hardware Support', 'Low', 'On-site',
  '33333333-3333-3333-3333-333333333306', '2026-11-19T14:05:00-05:00', null,
  'Assigned', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-19T14:00:00-05:00', 'h14',
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
  'a6267100-0000-4000-8000-000000000043', 'TKT-2026-0067', '11111111-1111-1111-1111-111111111101', 'a6267700-0000-4000-8000-000000000001', 'Shared drive permissions update — Northwind',
  'Software Support request logged for Northwind Manufacturing. Handled under Gold included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333308', '2026-11-03T08:05:00-05:00', null,
  'In Progress', 'Casey Plant', 'clientuser@nexus.demo',
  null, '2026-11-03T08:00:00-05:00', 'h08',
  2, 2, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

