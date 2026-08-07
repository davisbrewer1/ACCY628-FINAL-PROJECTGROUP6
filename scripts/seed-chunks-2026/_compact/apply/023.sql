insert into public.invoices (
  id, invoice_number, customer_id, contract_id, invoice_date, due_date,
  recurring_service_fee, additional_support_charges, software_charges, equipment_charges,
  other_charges, late_fee_amount, total_amount, amount_paid, remaining_balance, status,
  invoice_source, billing_period, created_by) values
('a6267300-0000-4000-8000-000000000064', 'INV-WB-2026-0100', '11111111-1111-1111-1111-111111111106', 'a6267700-0000-4000-8000-000000000006',
  '2026-03-09', '2026-03-31',
  0, 240, 0, 0, 0,
  0, 240, 240, 0, 'Paid',
  'work_entries', null, '33333333-3333-3333-3333-333333333305'),
('a6267300-0000-4000-8000-000000000065', 'INV-WB-2026-0101', '11111111-1111-1111-1111-111111111106', 'a6267700-0000-4000-8000-000000000006',
  '2026-06-08', '2026-06-30',
  0, 240, 0, 0, 0,
  0, 240, 240, 0, 'Paid',
  'work_entries', null, '33333333-3333-3333-3333-333333333305'),
('a6267300-0000-4000-8000-000000000066', 'INV-WB-2026-0102', '11111111-1111-1111-1111-111111111107', 'a6267700-0000-4000-8000-000000000007',
  '2026-03-09', '2026-03-31',
  0, 232.5, 0, 0, 0,
  0, 232.5, 232.5, 0, 'Paid',
  'work_entries', null, '33333333-3333-3333-3333-333333333305'
),
(62);
