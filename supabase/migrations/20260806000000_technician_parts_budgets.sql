-- Technician monthly parts restock budgets + order ledger + increase requests.
-- hardware_assets.customer_id is already nullable (inventory = unassigned).

alter table public.hardware_assets
  alter column customer_id drop not null;

create table if not exists public.technician_parts_budgets (
  technician_id uuid primary key references public.technicians (id) on delete cascade,
  monthly_limit numeric not null default 500 check (monthly_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table if not exists public.inventory_part_orders (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  part_id uuid not null references public.inventory_parts (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  total_cost numeric not null default 0 check (total_cost >= 0),
  ordered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_part_orders_tech_month_idx
  on public.inventory_part_orders (technician_id, created_at desc);

create index if not exists inventory_part_orders_part_idx
  on public.inventory_part_orders (part_id);

create table if not exists public.technician_budget_increase_requests (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  requested_limit numeric not null check (requested_limit >= 0),
  current_limit numeric not null check (current_limit >= 0),
  reason text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists technician_budget_increase_requests_status_idx
  on public.technician_budget_increase_requests (status, created_at desc);

alter table public.technician_parts_budgets enable row level security;
alter table public.inventory_part_orders enable row level security;
alter table public.technician_budget_increase_requests enable row level security;

drop policy if exists technician_parts_budgets_select on public.technician_parts_budgets;
create policy technician_parts_budgets_select
  on public.technician_parts_budgets for select to authenticated using (true);

drop policy if exists technician_parts_budgets_insert on public.technician_parts_budgets;
create policy technician_parts_budgets_insert
  on public.technician_parts_budgets for insert to authenticated with check (true);

drop policy if exists technician_parts_budgets_update on public.technician_parts_budgets;
create policy technician_parts_budgets_update
  on public.technician_parts_budgets for update to authenticated using (true) with check (true);

drop policy if exists inventory_part_orders_select on public.inventory_part_orders;
create policy inventory_part_orders_select
  on public.inventory_part_orders for select to authenticated using (true);

drop policy if exists inventory_part_orders_insert on public.inventory_part_orders;
create policy inventory_part_orders_insert
  on public.inventory_part_orders for insert to authenticated with check (true);

drop policy if exists technician_budget_increase_requests_select
  on public.technician_budget_increase_requests;
create policy technician_budget_increase_requests_select
  on public.technician_budget_increase_requests for select to authenticated using (true);

drop policy if exists technician_budget_increase_requests_insert
  on public.technician_budget_increase_requests;
create policy technician_budget_increase_requests_insert
  on public.technician_budget_increase_requests for insert to authenticated with check (true);

drop policy if exists technician_budget_increase_requests_update
  on public.technician_budget_increase_requests;
create policy technician_budget_increase_requests_update
  on public.technician_budget_increase_requests for update to authenticated using (true) with check (true);

-- Seed default $500 monthly limits for active technicians.
insert into public.technician_parts_budgets (technician_id, monthly_limit)
select t.id, 500
from public.technicians t
where t.active = true
on conflict (technician_id) do nothing;
