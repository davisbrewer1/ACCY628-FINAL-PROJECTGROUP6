-- Allow client termination requests alongside plan-change requests.

alter table public.contract_plan_change_requests
  add column if not exists request_type text not null default 'plan_change';

alter table public.contract_plan_change_requests
  drop constraint if exists contract_plan_change_requests_request_type_check;

alter table public.contract_plan_change_requests
  add constraint contract_plan_change_requests_request_type_check
  check (request_type in ('plan_change', 'termination'));

alter table public.contract_plan_change_requests
  alter column requested_plan_id drop not null;

alter table public.contract_plan_change_requests
  drop constraint if exists contract_plan_change_requests_request_shape_check;

alter table public.contract_plan_change_requests
  add constraint contract_plan_change_requests_request_shape_check
  check (
    (
      request_type = 'plan_change'
      and requested_plan_id is not null
    )
    or (
      request_type = 'termination'
      and requested_plan_id is null
    )
  );

comment on column public.contract_plan_change_requests.request_type is
  'plan_change = switch catalog plan; termination = end the contract entirely';
