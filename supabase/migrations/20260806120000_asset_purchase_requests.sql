-- Net-new asset purchase requests: ticket first, hardware_assets only on approve.

alter table public.asset_order_tickets
  alter column asset_id drop not null,
  alter column customer_id drop not null;

alter table public.asset_order_tickets
  add column if not exists category text,
  add column if not exists request_type text not null default 'purchase',
  add column if not exists created_asset_id uuid references public.hardware_assets (id) on delete set null;

alter table public.asset_order_tickets
  drop constraint if exists asset_order_tickets_request_type_check;

alter table public.asset_order_tickets
  add constraint asset_order_tickets_request_type_check
  check (request_type in ('purchase', 'replacement'));

-- Existing rows are replacements tied to an asset.
update public.asset_order_tickets
set request_type = 'replacement'
where asset_id is not null
  and request_type = 'purchase';

-- Unique active ticket per asset only when replacing (asset_id set).
drop index if exists public.asset_order_tickets_one_active_per_asset;

create unique index asset_order_tickets_one_active_per_asset
  on public.asset_order_tickets (asset_id)
  where asset_id is not null
    and status in ('Pending', 'Needs more information');

create index if not exists asset_order_tickets_created_asset_id_idx
  on public.asset_order_tickets (created_asset_id);
