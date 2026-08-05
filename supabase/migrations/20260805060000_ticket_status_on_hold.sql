-- Allow "On Hold" as a service ticket status (UI already offered it)

alter table public.service_tickets
  drop constraint if exists service_tickets_status_check;

alter table public.service_tickets
  add constraint service_tickets_status_check
  check (
    status = any (
      array[
        'New'::text,
        'Assigned'::text,
        'In Progress'::text,
        'On Hold'::text,
        'Waiting on Customer'::text,
        'Waiting on Vendor'::text,
        'Waiting on Approval'::text,
        'Escalated'::text,
        'Completed'::text,
        'Closed'::text
      ]
    )
  );
