-- Structured late fees: percent every N days past due (replaces free-text policy).
-- Applied onto invoice.late_fee_amount and rolled into total/remaining balance.

alter table public.service_plans
  add column if not exists late_fee_percent numeric not null default 0
    check (late_fee_percent >= 0),
  add column if not exists late_fee_period_days integer not null default 30
    check (late_fee_period_days > 0);

alter table public.contracts
  add column if not exists late_fee_percent numeric default 0
    check (late_fee_percent is null or late_fee_percent >= 0),
  add column if not exists late_fee_period_days integer default 30
    check (late_fee_period_days is null or late_fee_period_days > 0);

alter table public.invoices
  add column if not exists late_fee_amount numeric not null default 0
    check (late_fee_amount >= 0);

-- Seed / backfill common MSP-style terms: 1.5% every 30 days past due.
update public.service_plans
set
  late_fee_percent = 1.5,
  late_fee_period_days = 30,
  late_fee_policy = '1.5% every 30 days past due'
where coalesce(late_fee_percent, 0) = 0;

update public.contracts c
set
  late_fee_percent = coalesce(p.late_fee_percent, 1.5),
  late_fee_period_days = coalesce(p.late_fee_period_days, 30),
  late_fee_policy = coalesce(
    p.late_fee_policy,
    '1.5% every 30 days past due'
  )
from public.service_plans p
where c.plan_id = p.id;
