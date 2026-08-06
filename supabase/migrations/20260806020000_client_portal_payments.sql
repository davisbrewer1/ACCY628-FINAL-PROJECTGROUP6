-- Allow client portal users to record simulated payments against their own invoices.

create or replace function public.client_record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text default null,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_customer_id uuid := app_private.current_customer_id();
  v_payment_id uuid;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if not (
    app_private.is_admin()
    or app_private.is_billing()
    or (
      app_private.is_client()
      and v_customer_id is not null
      and v_invoice.customer_id = v_customer_id
    )
  ) then
    raise exception 'You can only pay invoices for your organization.';
  end if;

  if coalesce(v_invoice.remaining_balance, 0) <= 0 then
    raise exception 'This invoice is already paid in full.';
  end if;

  if p_amount > coalesce(v_invoice.remaining_balance, 0) then
    raise exception 'Payment cannot exceed the remaining balance of %.',
      round(coalesce(v_invoice.remaining_balance, 0)::numeric, 2);
  end if;

  insert into public.payments (
    invoice_id,
    customer_id,
    payment_date,
    payment_amount,
    payment_method,
    reference_number,
    notes,
    created_by
  ) values (
    v_invoice.id,
    v_invoice.customer_id,
    current_date,
    round(p_amount::numeric, 2),
    nullif(trim(coalesce(p_method, '')), ''),
    nullif(trim(coalesce(p_reference, '')), ''),
    coalesce(
      nullif(trim(coalesce(p_notes, '')), ''),
      'Client portal payment (simulated)'
    ),
    auth.uid()
  )
  returning id into v_payment_id;

  v_new_paid := coalesce(v_invoice.amount_paid, 0) + round(p_amount::numeric, 2);
  v_new_remaining := greatest(
    0,
    round(coalesce(v_invoice.total_amount, 0)::numeric, 2) - v_new_paid
  );

  if v_new_remaining <= 0 then
    v_status := 'Paid';
  elsif v_new_paid > 0 then
    if v_invoice.due_date is not null and v_invoice.due_date < current_date then
      v_status := 'Past Due';
    else
      v_status := 'Partially Paid';
    end if;
  else
    v_status := v_invoice.status;
  end if;

  update public.invoices
  set
    amount_paid = v_new_paid,
    remaining_balance = v_new_remaining,
    status = v_status
  where id = v_invoice.id;

  return v_payment_id;
end;
$$;

revoke all on function public.client_record_invoice_payment(uuid, numeric, text, text, text)
  from public;
grant execute on function public.client_record_invoice_payment(uuid, numeric, text, text, text)
  to authenticated;
