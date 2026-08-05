-- Technician notification center

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists notifications_technician_id_idx
  on public.notifications (technician_id, created_at desc);

create index if not exists notifications_technician_unread_idx
  on public.notifications (technician_id)
  where read = false;

alter table public.notifications enable row level security;

drop policy if exists "Technicians can read own notifications" on public.notifications;
create policy "Technicians can read own notifications"
  on public.notifications for select to authenticated
  using (
    technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('administrator', 'service_manager', 'account_manager')
    )
  );

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
  on public.notifications for insert to authenticated
  with check (true);

drop policy if exists "Technicians can update own notifications" on public.notifications;
create policy "Technicians can update own notifications"
  on public.notifications for update to authenticated
  using (
    technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('administrator', 'service_manager', 'account_manager')
    )
  )
  with check (
    technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('administrator', 'service_manager', 'account_manager')
    )
  );

drop policy if exists "Technicians can delete own notifications" on public.notifications;
create policy "Technicians can delete own notifications"
  on public.notifications for delete to authenticated
  using (
    technician_id in (
      select id from public.technicians where profile_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('administrator', 'service_manager')
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

insert into public.notifications (technician_id, type, message, read)
select t.id, v.type, replace(v.message, '{name}', t.technician_name), v.read
from public.technicians t
cross join (
  values
    ('ticket_assigned', 'New ticket assigned: Network outage at Riverbend Clinic — respond within SLA.', false),
    ('upcoming_task', 'Upcoming task: on-site visit scheduled within the next business day. Confirm parts and travel window.', false),
    ('sla_at_risk', 'SLA at risk: a Critical/High ticket assigned to you is due for resolution soon.', false),
    ('manager_message', 'Manager message: Please prioritize warranty-expiring assets flagged Needs Replacement this week.', false),
    ('customer_reply', 'Customer replied on an open ticket requesting an update before end of day.', true),
    ('work_approval', 'Reminder: billable work over $500 requires manager approval before closing.', true)
) as v(type, message, read)
where not exists (
  select 1 from public.notifications n where n.technician_id = t.id
);
