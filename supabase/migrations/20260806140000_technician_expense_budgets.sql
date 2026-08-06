-- Monthly Internal Company Expense limits per technician (mirror parts budgets).

create table if not exists public.technician_expense_budgets (
  technician_id uuid primary key references public.technicians (id) on delete cascade,
  monthly_limit numeric not null default 500 check (monthly_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.technician_expense_budgets enable row level security;

drop policy if exists technician_expense_budgets_select on public.technician_expense_budgets;
create policy technician_expense_budgets_select
  on public.technician_expense_budgets for select to authenticated using (true);

drop policy if exists technician_expense_budgets_insert on public.technician_expense_budgets;
create policy technician_expense_budgets_insert
  on public.technician_expense_budgets for insert to authenticated with check (true);

drop policy if exists technician_expense_budgets_update on public.technician_expense_budgets;
create policy technician_expense_budgets_update
  on public.technician_expense_budgets for update to authenticated using (true) with check (true);

-- Seed default $500 monthly limits for active technicians.
insert into public.technician_expense_budgets (technician_id, monthly_limit)
select t.id, 500
from public.technicians t
where t.active = true
on conflict (technician_id) do nothing;
