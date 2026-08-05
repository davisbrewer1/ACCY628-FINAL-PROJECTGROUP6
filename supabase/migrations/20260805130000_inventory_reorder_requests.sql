create table if not exists public.inventory_reorder_requests (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.inventory_parts (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_quantity integer not null check (requested_quantity > 0 and requested_quantity <= 50),
  notes text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_reorder_requests_status_idx
  on public.inventory_reorder_requests (status, created_at desc);

create index if not exists inventory_reorder_requests_part_idx
  on public.inventory_reorder_requests (part_id);

alter table public.inventory_reorder_requests enable row level security;

drop policy if exists "Authenticated users can read inventory_reorder_requests"
  on public.inventory_reorder_requests;
create policy "Authenticated users can read inventory_reorder_requests"
  on public.inventory_reorder_requests for select to authenticated using (true);

drop policy if exists "Authenticated users can insert inventory_reorder_requests"
  on public.inventory_reorder_requests;
create policy "Authenticated users can insert inventory_reorder_requests"
  on public.inventory_reorder_requests for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update inventory_reorder_requests"
  on public.inventory_reorder_requests;
create policy "Authenticated users can update inventory_reorder_requests"
  on public.inventory_reorder_requests for update to authenticated using (true) with check (true);
