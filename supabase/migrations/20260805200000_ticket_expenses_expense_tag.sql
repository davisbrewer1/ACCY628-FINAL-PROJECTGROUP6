-- Expense tag: billable vs internal company expense

alter table public.ticket_expenses
  add column if not exists expense_tag text not null
    default 'Internal Company Expense'
    check (expense_tag in ('Billable to Customer', 'Internal Company Expense'));

comment on column public.ticket_expenses.expense_tag is
  'Billable to Customer or Internal Company Expense';
