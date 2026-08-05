-- Service plans catalog for manager-defined commercial offerings.
-- Contracts snapshot plan terms at creation so retired/edited plans
-- do not rewrite historical revenue recognition.

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  pricing_model text not null default 'Monthly'
    check (pricing_model in ('Monthly', 'Yearly', 'Up-front')),
  base_price numeric not null default 0 check (base_price >= 0),
  included_support_hours numeric not null default 0 check (included_support_hours >= 0),
  included_asset_budget numeric not null default 0 check (included_asset_budget >= 0),
  additional_hourly_rate numeric not null default 0 check (additional_hourly_rate >= 0),
  additional_asset_rate numeric not null default 1 check (additional_asset_rate >= 0),
  billing_frequency text not null default 'Monthly',
  payment_terms text,
  invoice_due_days numeric default 30,
  setup_fee numeric not null default 0 check (setup_fee >= 0),
  late_fee_policy text,
  revenue_recognition_method text
    default 'Monthly over service period',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists service_plans_active_idx
  on public.service_plans (active);

alter table public.contracts
  add column if not exists plan_id uuid references public.service_plans (id)
    on delete set null;

alter table public.contracts
  add column if not exists included_asset_budget numeric default 0;

alter table public.contracts
  add column if not exists additional_asset_rate numeric default 1;

create index if not exists contracts_plan_id_idx
  on public.contracts (plan_id);

alter table public.service_plans enable row level security;

drop policy if exists service_plans_select on public.service_plans;
create policy service_plans_select
  on public.service_plans
  for select
  to authenticated
  using (
    app_private.is_admin()
    or app_private.is_executive()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
    or app_private.current_role() = 'billing'
    or app_private.current_customer_id() is not null
  );

drop policy if exists service_plans_insert on public.service_plans;
create policy service_plans_insert
  on public.service_plans
  for insert
  to authenticated
  with check (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
  );

drop policy if exists service_plans_update on public.service_plans;
create policy service_plans_update
  on public.service_plans
  for update
  to authenticated
  using (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
  )
  with check (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
  );

-- Seed three mock tiers aligned to existing demo contract economics.
insert into public.service_plans (
  id,
  name,
  description,
  pricing_model,
  base_price,
  included_support_hours,
  included_asset_budget,
  additional_hourly_rate,
  additional_asset_rate,
  billing_frequency,
  payment_terms,
  invoice_due_days,
  setup_fee,
  late_fee_policy,
  revenue_recognition_method,
  active
) values
  (
    '55555555-5555-5555-5555-555555555501',
    'Essentials',
    'Entry managed-support tier for smaller sites: core remote support with a modest hardware deployment budget.',
    'Monthly',
    1800,
    10,
    5000,
    160,
    1,
    'Monthly',
    'Net 30',
    30,
    0,
    '1.5% per month on past-due balances',
    'Monthly over service period',
    true
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    'Silver',
    'Mid-tier MSP plan with expanded included hours and hardware deployment allowance.',
    'Monthly',
    2800,
    20,
    15000,
    155,
    1,
    'Monthly',
    'Net 30',
    30,
    500,
    '1.5% per month on past-due balances',
    'Monthly over service period',
    true
  ),
  (
    '55555555-5555-5555-5555-555555555503',
    'Gold',
    'Full-service MSP tier with priority support hours and a larger contract-length asset budget.',
    'Monthly',
    4500,
    40,
    40000,
    145,
    1,
    'Monthly',
    'Net 30',
    30,
    0,
    '1.5% per month on past-due balances',
    'Monthly over service period',
    true
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  pricing_model = excluded.pricing_model,
  base_price = excluded.base_price,
  included_support_hours = excluded.included_support_hours,
  included_asset_budget = excluded.included_asset_budget,
  additional_hourly_rate = excluded.additional_hourly_rate,
  additional_asset_rate = excluded.additional_asset_rate,
  billing_frequency = excluded.billing_frequency,
  payment_terms = excluded.payment_terms,
  invoice_due_days = excluded.invoice_due_days,
  setup_fee = excluded.setup_fee,
  late_fee_policy = excluded.late_fee_policy,
  revenue_recognition_method = excluded.revenue_recognition_method,
  active = excluded.active;

-- Remap demo contracts onto the seeded plans and refresh commercial snapshots.
update public.contracts c
set
  plan_id = p.id,
  service_plan_name = p.name,
  monthly_recurring_fee = p.base_price,
  included_support_hours = p.included_support_hours,
  additional_hourly_rate = p.additional_hourly_rate,
  included_asset_budget = p.included_asset_budget,
  additional_asset_rate = p.additional_asset_rate,
  billing_frequency = p.billing_frequency,
  payment_terms = coalesce(c.payment_terms, p.payment_terms),
  invoice_due_days = coalesce(c.invoice_due_days, p.invoice_due_days),
  setup_fee = p.setup_fee,
  late_fee_policy = coalesce(c.late_fee_policy, p.late_fee_policy),
  revenue_recognition_method = coalesce(
    c.revenue_recognition_method,
    p.revenue_recognition_method
  )
from public.service_plans p
where p.id = case
  when lower(coalesce(c.service_plan_name, '')) in ('gold', 'enterprise', 'education plus')
    then '55555555-5555-5555-5555-555555555503'::uuid
  when lower(coalesce(c.service_plan_name, '')) in ('silver', 'proposed silver', 'continuity', 'legacy')
    then '55555555-5555-5555-5555-555555555502'::uuid
  when lower(coalesce(c.service_plan_name, '')) in ('essentials', 'basic', 'backup plus')
    then '55555555-5555-5555-5555-555555555501'::uuid
  else '55555555-5555-5555-5555-555555555502'::uuid
end;
