create table if not exists public.ticket_hour_extension_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  current_max_hours integer not null check (current_max_hours >= 1 and current_max_hours <= 9),
  requested_hours integer not null check (requested_hours >= 1 and requested_hours <= 9),
  reason text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Denied', 'Cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint ticket_hour_extension_requests_hours_check
    check (requested_hours > current_max_hours)
);

create index if not exists ticket_hour_extension_requests_status_idx
  on public.ticket_hour_extension_requests (status, created_at desc);

create index if not exists ticket_hour_extension_requests_ticket_idx
  on public.ticket_hour_extension_requests (ticket_id);

create index if not exists ticket_hour_extension_requests_tech_idx
  on public.ticket_hour_extension_requests (technician_id);

comment on table public.ticket_hour_extension_requests is
  'Technician requests to raise manager-set max_hours on a service ticket';
