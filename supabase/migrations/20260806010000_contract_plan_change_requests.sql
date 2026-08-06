-- Client plan upgrades become requests for management approval.
-- Also remove direct client contract updates.

create table if not exists public.contract_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  current_plan_id uuid references public.service_plans (id) on delete set null,
  requested_plan_id uuid not null references public.service_plans (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'Pending'
    check (status in ('Pending', 'Approved', 'Denied', 'Cancelled')),
  client_note text,
  manager_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_plan_change_requests_status_idx
  on public.contract_plan_change_requests (status);

create index if not exists contract_plan_change_requests_customer_id_idx
  on public.contract_plan_change_requests (customer_id);

create index if not exists contract_plan_change_requests_contract_id_idx
  on public.contract_plan_change_requests (contract_id);

-- Only one open request per contract at a time.
create unique index if not exists contract_plan_change_requests_pending_unique
  on public.contract_plan_change_requests (contract_id)
  where status = 'Pending';

alter table public.contract_plan_change_requests enable row level security;

drop policy if exists contract_plan_change_requests_select on public.contract_plan_change_requests;
create policy contract_plan_change_requests_select
  on public.contract_plan_change_requests
  for select
  to authenticated
  using (
    app_private.is_admin()
    or app_private.is_executive()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
    or app_private.current_role() = 'billing'
    or customer_id = app_private.current_customer_id()
  );

drop policy if exists contract_plan_change_requests_insert on public.contract_plan_change_requests;
create policy contract_plan_change_requests_insert
  on public.contract_plan_change_requests
  for insert
  to authenticated
  with check (
    (
      app_private.is_admin()
      or (
        app_private.is_client()
        and customer_id = app_private.current_customer_id()
        and requested_by = auth.uid()
      )
    )
    and status = 'Pending'
  );

drop policy if exists contract_plan_change_requests_update on public.contract_plan_change_requests;
create policy contract_plan_change_requests_update
  on public.contract_plan_change_requests
  for update
  to authenticated
  using (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
    or (
      app_private.is_client()
      and customer_id = app_private.current_customer_id()
      and requested_by = auth.uid()
    )
  )
  with check (
    app_private.is_admin()
    or app_private.is_service_ops()
    or app_private.is_account_manager()
    or (
      app_private.is_client()
      and customer_id = app_private.current_customer_id()
      and requested_by = auth.uid()
    )
  );

-- Clients should not directly rewrite contract commercial terms.
drop policy if exists contracts_update_client on public.contracts;
