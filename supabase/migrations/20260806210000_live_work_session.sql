-- Persist technician en-route + live work timer across logout / navigation.

alter table public.service_tickets
  add column if not exists en_route boolean not null default false;

alter table public.service_tickets
  add column if not exists live_timer_banked_seconds integer not null default 0;

alter table public.service_tickets
  add column if not exists live_timer_segment_started_at timestamptz null;

alter table public.service_tickets
  add column if not exists live_timer_paused boolean not null default false;

comment on column public.service_tickets.en_route is
  'Technician marked On the way; cleared when on-site timer starts or session ends.';
comment on column public.service_tickets.live_timer_banked_seconds is
  'Seconds already banked for the live on-site/remote timer (excludes active segment).';
comment on column public.service_tickets.live_timer_segment_started_at is
  'Wall-clock start of the current unpaused timer segment.';
comment on column public.service_tickets.live_timer_paused is
  'True when the live timer is paused; time does not accrue until resume.';
