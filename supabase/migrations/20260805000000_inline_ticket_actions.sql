-- Inline ticket actions support: work notes, attachments, flags, storage.

create table if not exists public.work_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_flags (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  flag_type text not null check (flag_type in ('security', 'ai')),
  created_at timestamptz not null default now()
);

create index if not exists work_notes_ticket_id_idx on public.work_notes (ticket_id);
create index if not exists attachments_ticket_id_idx on public.attachments (ticket_id);
create index if not exists ticket_flags_ticket_id_idx on public.ticket_flags (ticket_id);

alter table public.work_notes enable row level security;
alter table public.attachments enable row level security;
alter table public.ticket_flags enable row level security;

create policy "Authenticated users can read work_notes"
  on public.work_notes for select to authenticated using (true);
create policy "Authenticated users can insert work_notes"
  on public.work_notes for insert to authenticated with check (true);

create policy "Authenticated users can read attachments"
  on public.attachments for select to authenticated using (true);
create policy "Authenticated users can insert attachments"
  on public.attachments for insert to authenticated with check (true);

create policy "Authenticated users can read ticket_flags"
  on public.ticket_flags for select to authenticated using (true);
create policy "Authenticated users can insert ticket_flags"
  on public.ticket_flags for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload ticket attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-attachments');

create policy "Authenticated users can read ticket attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments');

create policy "Authenticated users can update ticket attachments"
  on storage.objects for update to authenticated
  using (bucket_id = 'ticket-attachments')
  with check (bucket_id = 'ticket-attachments');
