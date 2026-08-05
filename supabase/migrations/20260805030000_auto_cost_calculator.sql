-- Automatic cost calculation support tables

alter table public.technicians
  add column if not exists hourly_rate numeric;

update public.technicians
set hourly_rate = internal_hourly_cost
where hourly_rate is null and internal_hourly_cost is not null;

alter table public.contracts
  add column if not exists included_services text[] default '{}';

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_parts (
  id uuid primary key default gen_random_uuid(),
  part_name text not null,
  sku text,
  unit_cost numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.software_catalog (
  id uuid primary key default gen_random_uuid(),
  software_name text not null,
  license_cost numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  work_entry_id uuid references public.work_entries (id) on delete set null,
  ticket_id uuid references public.service_tickets (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  labor_hours numeric not null default 0,
  miles numeric not null default 0,
  other_category text,
  labor_cost numeric not null default 0,
  travel_cost numeric not null default 0,
  equipment_cost numeric not null default 0,
  software_cost numeric not null default 0,
  other_cost numeric not null default 0,
  total_cost numeric not null default 0,
  billing_status text not null default 'Billable',
  approval_required boolean not null default false,
  approval_status text not null default 'Pending',
  service_key text,
  parts_used jsonb not null default '[]',
  software_installed jsonb not null default '[]',
  overrides jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cost_entries_ticket_id_idx on public.cost_entries (ticket_id);
create index if not exists cost_entries_technician_id_idx on public.cost_entries (technician_id);

alter table public.app_settings enable row level security;
alter table public.inventory_parts enable row level security;
alter table public.software_catalog enable row level security;
alter table public.cost_entries enable row level security;

drop policy if exists "Authenticated users can read app_settings" on public.app_settings;
create policy "Authenticated users can read app_settings"
  on public.app_settings for select to authenticated using (true);
drop policy if exists "Managers can write app_settings" on public.app_settings;
create policy "Managers can write app_settings"
  on public.app_settings for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager', 'billing')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager', 'billing')
    )
  );

drop policy if exists "Authenticated users can read inventory_parts" on public.inventory_parts;
create policy "Authenticated users can read inventory_parts"
  on public.inventory_parts for select to authenticated using (true);
drop policy if exists "Authenticated users can read software_catalog" on public.software_catalog;
create policy "Authenticated users can read software_catalog"
  on public.software_catalog for select to authenticated using (true);

drop policy if exists "Authenticated users can read cost_entries" on public.cost_entries;
create policy "Authenticated users can read cost_entries"
  on public.cost_entries for select to authenticated using (true);
drop policy if exists "Authenticated users can insert cost_entries" on public.cost_entries;
create policy "Authenticated users can insert cost_entries"
  on public.cost_entries for insert to authenticated with check (true);
drop policy if exists "Authenticated users can update cost_entries" on public.cost_entries;
create policy "Authenticated users can update cost_entries"
  on public.cost_entries for update to authenticated using (true) with check (true);

insert into public.app_settings (key, value)
values
  ('travel_rate', '0.67'::jsonb),
  ('approval_threshold', '500'::jsonb),
  (
    'other_costs',
    '{"Disposal": 75, "Emergency Fee": 150, "After Hours": 95, "None": 0}'::jsonb
  )
on conflict (key) do nothing;

insert into public.inventory_parts (part_name, sku, unit_cost)
select * from (values
  ('Cat6 Patch Cable 7ft', 'NET-C6-7', 8.50),
  ('SSD 1TB SATA', 'STOR-SSD-1T', 89.00),
  ('Wireless Keyboard/Mouse Kit', 'PER-KBMS-01', 42.00),
  ('UPS Battery Replacement', 'PWR-UPS-BAT', 65.00)
) as seed(part_name, sku, unit_cost)
where not exists (select 1 from public.inventory_parts limit 1);

insert into public.software_catalog (software_name, license_cost)
select * from (values
  ('Endpoint Protection Seat', 12.00),
  ('Remote Support Agent', 8.00),
  ('Office Productivity License', 22.00),
  ('Backup Agent', 15.00)
) as seed(software_name, license_cost)
where not exists (select 1 from public.software_catalog limit 1);

update public.contracts
set included_services = array['Remote Support', 'Monitoring', 'Patching']
where included_services is null or cardinality(included_services) = 0;
