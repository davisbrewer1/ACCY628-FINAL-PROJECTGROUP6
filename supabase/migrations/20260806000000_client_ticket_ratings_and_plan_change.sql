-- Client portal: rate closed tickets + allow clients to change their contract plan.

create table if not exists public.ticket_ratings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.service_tickets (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  technician_id uuid references public.technicians (id) on delete set null,
  rated_by uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_ratings_ticket_id_unique unique (ticket_id)
);

create index if not exists ticket_ratings_customer_id_idx
  on public.ticket_ratings (customer_id);

create index if not exists ticket_ratings_technician_id_idx
  on public.ticket_ratings (technician_id);

alter table public.ticket_ratings enable row level security;

drop policy if exists ticket_ratings_select on public.ticket_ratings;
create policy ticket_ratings_select
  on public.ticket_ratings
  for select
  to authenticated
  using (
    app_private.is_admin()
    or app_private.is_executive()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
    or customer_id = app_private.current_customer_id()
  );

drop policy if exists ticket_ratings_insert on public.ticket_ratings;
create policy ticket_ratings_insert
  on public.ticket_ratings
  for insert
  to authenticated
  with check (
    (
      app_private.is_admin()
      or (
        app_private.is_client()
        and customer_id = app_private.current_customer_id()
        and rated_by = auth.uid()
      )
    )
    and exists (
      select 1
      from public.service_tickets st
      where st.id = ticket_id
        and st.customer_id = ticket_ratings.customer_id
        and st.status in ('Completed', 'Closed')
    )
  );

drop policy if exists ticket_ratings_update on public.ticket_ratings;
create policy ticket_ratings_update
  on public.ticket_ratings
  for update
  to authenticated
  using (
    app_private.is_admin()
    or (
      app_private.is_client()
      and customer_id = app_private.current_customer_id()
      and rated_by = auth.uid()
    )
  )
  with check (
    app_private.is_admin()
    or (
      app_private.is_client()
      and customer_id = app_private.current_customer_id()
      and rated_by = auth.uid()
    )
  );

-- Allow client users to update their own contracts (plan changes via portal action).
drop policy if exists contracts_update_client on public.contracts;
create policy contracts_update_client
  on public.contracts
  for update
  to authenticated
  using (
    app_private.is_client()
    and customer_id = app_private.current_customer_id()
  )
  with check (
    app_private.is_client()
    and customer_id = app_private.current_customer_id()
  );
