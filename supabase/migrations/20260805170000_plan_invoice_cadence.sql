-- Idempotent auto-generated plan / asset-overage invoices.
-- invoice_source + billing_period uniquely identify a cadence invoice per contract.

alter table public.invoices
  add column if not exists invoice_source text not null default 'manual'
    check (invoice_source in ('manual', 'plan_recurring', 'work_entries', 'asset_overage'));

alter table public.invoices
  add column if not exists billing_period text;

create unique index if not exists invoices_contract_source_period_uidx
  on public.invoices (contract_id, invoice_source, billing_period)
  where contract_id is not null
    and billing_period is not null
    and invoice_source in ('plan_recurring', 'asset_overage');

comment on column public.invoices.invoice_source is
  'Origin of the invoice: manual, plan_recurring (cash cadence), work_entries, or asset_overage.';

comment on column public.invoices.billing_period is
  'Cadence key such as 2026-08 (monthly), 2026 (yearly), upfront, setup, or contract-term for asset overage.';
