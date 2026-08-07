-- Allow client portal users to read active technicians so the service-date
-- calendar can compute openings. Previously clients only saw technicians
-- already assigned to one of their tickets, which left zero availability
-- for new customers (and after ticket wipes).

drop policy if exists technicians_select on public.technicians;

create policy technicians_select
  on public.technicians
  for select
  to public
  using (
    app_private.is_admin()
    or app_private.is_manager()
    or (profile_id = auth.uid())
    or (
      app_private.current_role() = any (
        array[
          'billing_specialist'::text,
          'billing'::text,
          'technician'::text
        ]
      )
    )
    or (app_private.is_client() and active = true)
  );
