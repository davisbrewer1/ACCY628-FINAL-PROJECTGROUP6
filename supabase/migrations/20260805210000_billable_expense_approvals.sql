-- Billable expense → management approval for customer invoice eligibility
-- Creates approvals tables if missing (remote may not have had them yet)

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  manager_id uuid references public.profiles (id) on delete set null,
  cost_entry_id uuid references public.cost_entries (id) on delete set null,
  work_entry_id uuid references public.work_entries (id) on delete set null,
  ticket_expense_id uuid references public.ticket_expenses (id) on delete set null,
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
create index if not exists approvals_ticket_expense_id_idx on public.approvals (ticket_expense_id);

alter table public.approvals enable row level security;
alter table public.approval_attachments enable row level security;

drop policy if exists "Authenticated users can read approvals" on public.approvals;
create policy "Authenticated users can read approvals"
  on public.approvals for select to authenticated using (true);

drop policy if exists "Technicians and managers can insert approvals" on public.approvals;
create policy "Technicians and managers can insert approvals"
  on public.approvals for insert to authenticated with check (true);

drop policy if exists "Managers can update approvals" on public.approvals;
create policy "Managers can update approvals"
  on public.approvals for update to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read approval_attachments" on public.approval_attachments;
create policy "Authenticated users can read approval_attachments"
  on public.approval_attachments for select to authenticated using (true);

drop policy if exists "Authenticated users can insert approval_attachments" on public.approval_attachments;
create policy "Authenticated users can insert approval_attachments"
  on public.approval_attachments for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('approval-attachments', 'approval-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload approval attachments" on storage.objects;
create policy "Authenticated users can upload approval attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'approval-attachments');

drop policy if exists "Authenticated users can read approval attachments" on storage.objects;
create policy "Authenticated users can read approval attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'approval-attachments');

alter table public.ticket_expenses
  add column if not exists approval_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ticket_expenses_approval_status_check'
  ) then
    alter table public.ticket_expenses
      add constraint ticket_expenses_approval_status_check
      check (
        approval_status is null
        or approval_status in ('Pending', 'Approved', 'Denied')
      );
  end if;
end $$;

alter table public.approvals
  add column if not exists ticket_expense_id uuid
    references public.ticket_expenses (id) on delete set null;

comment on column public.ticket_expenses.approval_status is
  'Manager decision for Billable to Customer expenses (invoice eligibility)';

comment on column public.approvals.ticket_expense_id is
  'Optional linked ticket expense awaiting invoice approval';
