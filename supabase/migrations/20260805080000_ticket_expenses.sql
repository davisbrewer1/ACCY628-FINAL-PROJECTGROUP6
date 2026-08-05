-- Simple per-ticket expense tracker

create table if not exists public.ticket_expenses (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  type text not null
    check (type in ('Travel', 'Supplies', 'Meals', 'Parking', 'Miscellaneous')),
  amount numeric not null check (amount > 0),
  description text,
  date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_expenses_ticket_id_idx
  on public.ticket_expenses (ticket_id, date desc);

create index if not exists ticket_expenses_technician_id_idx
  on public.ticket_expenses (technician_id, created_at desc);

alter table public.ticket_expenses enable row level security;

drop policy if exists "Authenticated users can read ticket_expenses" on public.ticket_expenses;
create policy "Authenticated users can read ticket_expenses"
  on public.ticket_expenses for select to authenticated using (true);

drop policy if exists "Authenticated users can insert ticket_expenses" on public.ticket_expenses;
create policy "Authenticated users can insert ticket_expenses"
  on public.ticket_expenses for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update ticket_expenses" on public.ticket_expenses;
create policy "Authenticated users can update ticket_expenses"
  on public.ticket_expenses for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete ticket_expenses" on public.ticket_expenses;
create policy "Authenticated users can delete ticket_expenses"
  on public.ticket_expenses for delete to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload expense receipts" on storage.objects;
create policy "Authenticated users can upload expense receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts');

drop policy if exists "Authenticated users can read expense receipts" on storage.objects;
create policy "Authenticated users can read expense receipts"
  on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts');

drop policy if exists "Authenticated users can delete expense receipts" on storage.objects;
create policy "Authenticated users can delete expense receipts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts');
