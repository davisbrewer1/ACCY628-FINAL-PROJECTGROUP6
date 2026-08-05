-- Cost / work approval workflow

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  manager_id uuid references public.profiles (id) on delete set null,
  cost_entry_id uuid references public.cost_entries (id) on delete set null,
  work_entry_id uuid references public.work_entries (id) on delete set null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Denied')),
  reason text,
  manager_notes text,
  total_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_attachments (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists approvals_status_idx on public.approvals (status, created_at desc);
create index if not exists approvals_technician_id_idx on public.approvals (technician_id);
create index if not exists approvals_ticket_id_idx on public.approvals (ticket_id);

alter table public.approvals enable row level security;
alter table public.approval_attachments enable row level security;

create policy "Authenticated users can read approvals"
  on public.approvals for select to authenticated using (true);

create policy "Technicians and managers can insert approvals"
  on public.approvals for insert to authenticated with check (true);

create policy "Managers can update approvals"
  on public.approvals for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager', 'account_manager')
    )
    or technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('administrator', 'service_manager', 'account_manager')
    )
    or technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
  );

create policy "Authenticated users can read approval_attachments"
  on public.approval_attachments for select to authenticated using (true);

create policy "Authenticated users can insert approval_attachments"
  on public.approval_attachments for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('approval-attachments', 'approval-attachments', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload approval attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'approval-attachments');

create policy "Authenticated users can read approval attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'approval-attachments');
