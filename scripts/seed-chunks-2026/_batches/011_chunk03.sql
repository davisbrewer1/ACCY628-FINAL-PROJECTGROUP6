insert into public.service_tickets (
  id, ticket_number, customer_id, contract_id, title, description, category, priority, service_method,
  assigned_technician_id, opened_at, completed_at, status, requester_name, requester_email,
  resolution_notes, scheduled_start, scheduled_window, max_hours, allocated_hours,
  customer_approval_required, additional_work_suspected, ai_involved, cybersecurity_incident,
  additional_billable_work, is_asap, scheduled_off_requested_day, customer_rescheduled, en_route,
  live_timer_banked_seconds, live_timer_paused, notes
) values (
  'a6267100-0000-4000-8000-000000000083', 'TKT-2026-0131', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'M365 mailbox restore request — Harbor',
  'Microsoft 365 request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Microsoft 365', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333305', '2026-07-13T13:05:00-05:00', '2026-07-13T15:20:00-05:00',
  'Completed', 'Sam Harbor', 'ops@harborretail.demo',
  'Resolved for Sam Harbor. Changes documented and validated with end users.', '2026-07-13T13:00:00-05:00', 'h13',
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
  'a6267100-0000-4000-8000-000000000084', 'TKT-2026-0132', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Patch cycle review and reboot window — Harbor',
  'Software Support request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333308', '2026-08-05T12:05:00-05:00', null,
  'In Progress', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-08-05T12:00:00-05:00', 'h12',
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
  'a6267100-0000-4000-8000-000000000085', 'TKT-2026-0133', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Firewall rule change for vendor access — Harbor',
  'Network request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Network', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333309', '2026-08-10T14:05:00-05:00', null,
  'In Progress', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-08-10T14:00:00-05:00', 'h14',
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
  'a6267100-0000-4000-8000-000000000086', 'TKT-2026-0134', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Endpoint AV quarantine investigation — Harbor',
  'Cybersecurity request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Cybersecurity', 'Critical', 'Remote',
  '33333333-3333-3333-3333-333333333301', '2026-08-13T08:05:00-05:00', null,
  'New', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-08-13T08:00:00-05:00', 'h08x3',
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
  'a6267100-0000-4000-8000-000000000087', 'TKT-2026-0135', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Printer mapping and driver cleanup — Harbor',
  'Hardware Support request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Hardware Support', 'Low', 'On-site',
  '33333333-3333-3333-3333-333333333302', '2026-08-17T10:05:00-05:00', null,
  'Assigned', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-08-17T10:00:00-05:00', 'h10',
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
  'a6267100-0000-4000-8000-000000000088', 'TKT-2026-0136', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Shared drive permissions update — Harbor',
  'Software Support request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Software Support', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-09-07T08:05:00-05:00', null,
  'In Progress', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-09-07T08:00:00-05:00', 'h08',
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
  'a6267100-0000-4000-8000-000000000089', 'TKT-2026-0137', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Wi-Fi dead spot survey — Harbor',
  'Network request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Network', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333305', '2026-09-09T10:05:00-05:00', null,
  'New', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-09-09T10:00:00-05:00', 'h10x3',
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
  'a6267100-0000-4000-8000-00000000008a', 'TKT-2026-0138', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Backup job failure triage — Harbor',
  'Cloud request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333306', '2026-09-14T12:05:00-05:00', null,
  'Assigned', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-09-14T12:00:00-05:00', 'h12',
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
  'a6267100-0000-4000-8000-00000000008b', 'TKT-2026-0139', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'New hire workstation setup — Harbor',
  'Hardware Deployment request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Hardware Deployment', 'Medium', 'On-site',
  '33333333-3333-3333-3333-333333333309', '2026-10-05T11:05:00-05:00', null,
  'In Progress', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-10-05T11:00:00-05:00', 'h11',
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
  'a6267100-0000-4000-8000-00000000008c', 'TKT-2026-0140', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Phishing report triage — Harbor',
  'Cybersecurity request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Cybersecurity', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333301', '2026-10-09T13:05:00-05:00', null,
  'New', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-10-09T13:00:00-05:00', 'h13',
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
  'a6267100-0000-4000-8000-00000000008d', 'TKT-2026-0141', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Server disk capacity expansion — Harbor',
  'Cloud request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Cloud', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333302', '2026-10-13T15:05:00-05:00', null,
  'Assigned', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-10-13T15:00:00-05:00', 'h15x3',
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
  'a6267100-0000-4000-8000-00000000008e', 'TKT-2026-0142', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'QoS tuning for VoIP quality — Harbor',
  'Network request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Network', 'Medium', 'Remote',
  '33333333-3333-3333-3333-333333333304', '2026-11-05T14:05:00-05:00', null,
  'In Progress', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-11-05T14:00:00-05:00', 'h14',
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
  'a6267100-0000-4000-8000-00000000008f', 'TKT-2026-0143', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'Application licensing renewal assist — Harbor',
  'Software Support request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Software Support', 'Low', 'Remote',
  '33333333-3333-3333-3333-333333333305', '2026-11-09T08:05:00-05:00', null,
  'New', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-11-09T08:00:00-05:00', 'h08',
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
  'a6267100-0000-4000-8000-000000000090', 'TKT-2026-0144', '11111111-1111-1111-1111-111111111103', 'a6267700-0000-4000-8000-000000000003', 'VPN dropouts for remote staff — Harbor',
  'Network request logged for Harbor Retail Collective. Handled under Silver included hours where possible.', 'Network', 'High', 'Remote',
  '33333333-3333-3333-3333-333333333306', '2026-11-13T10:05:00-05:00', null,
  'Assigned', 'Sam Harbor', 'ops@harborretail.demo',
  null, '2026-11-13T10:00:00-05:00', 'h10',
  4, 4, false, false, false, false,
  false, false, false, false, false, 0, false,
  'Seeded 2026 MSP operations history.'
);

