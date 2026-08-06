alter table public.service_tickets
  add column if not exists max_hours integer;

comment on column public.service_tickets.max_hours is
  'Manager-set maximum hours the technician may schedule for this ticket';

alter table public.service_tickets
  drop constraint if exists service_tickets_max_hours_check;

alter table public.service_tickets
  add constraint service_tickets_max_hours_check
  check (max_hours is null or (max_hours >= 1 and max_hours <= 9));
