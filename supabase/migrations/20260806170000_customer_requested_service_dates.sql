-- Customer-requested service scheduling
alter table public.service_tickets
  add column if not exists is_asap boolean not null default false,
  add column if not exists locked_service_date date,
  add column if not exists original_requested_date date,
  add column if not exists scheduled_off_requested_day boolean not null default false,
  add column if not exists customer_rescheduled boolean not null default false;

comment on column public.service_tickets.is_asap is
  'Customer selected ASAP-Emergency; treated as Critical and assigned to next-available tech.';
comment on column public.service_tickets.locked_service_date is
  'Customer-locked service day. Tech may schedule this day, or the next business day if this day has no opening for them.';
comment on column public.service_tickets.original_requested_date is
  'First customer-requested service day (unchanged by later customer reschedules).';
comment on column public.service_tickets.scheduled_off_requested_day is
  'True when the tech placed the visit on the day after the locked service date.';
comment on column public.service_tickets.customer_rescheduled is
  'True after the customer reschedules; ticket returns to Needs scheduling with an updated locked date.';
