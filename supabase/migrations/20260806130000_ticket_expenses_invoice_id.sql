-- Link billed Expense Tracker items to invoices (billable + approved only).

alter table public.ticket_expenses
  add column if not exists invoice_id uuid
    references public.invoices (id) on delete set null;

create index if not exists ticket_expenses_invoice_id_idx
  on public.ticket_expenses (invoice_id);

create index if not exists ticket_expenses_ready_to_invoice_idx
  on public.ticket_expenses (approval_status, expense_tag)
  where invoice_id is null;

-- Allow expense-sourced invoices
alter table public.invoices drop constraint if exists invoices_invoice_source_check;
alter table public.invoices add constraint invoices_invoice_source_check
  check (
    invoice_source = any (
      array[
        'manual'::text,
        'plan_recurring'::text,
        'work_entries'::text,
        'asset_overage'::text,
        'ticket_expenses'::text
      ]
    )
  );
