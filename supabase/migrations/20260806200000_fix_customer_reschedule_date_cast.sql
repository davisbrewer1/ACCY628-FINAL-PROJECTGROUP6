-- Fix customer reschedule RPC: locked_service_date is date, not text.
-- Prior version raised 400: column "locked_service_date" is of type date
-- but expression is of type text — so nothing was saved and techs never notified.

CREATE OR REPLACE FUNCTION public.customer_reschedule_service_ticket(
  p_ticket_id uuid,
  p_new_date text
)
RETURNS public.service_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_date_text text := left(trim(coalesce(p_new_date, '')), 10);
  v_date date;
  v_row public.service_tickets;
  v_old_number text;
  v_title text;
BEGIN
  IF v_date_text !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Choose a valid service day.';
  END IF;

  BEGIN
    v_date := v_date_text::date;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Choose a valid service day.';
  END;

  BEGIN
    v_customer_id := app_private.current_customer_id();
  EXCEPTION
    WHEN undefined_function THEN
      v_customer_id := null;
  END;

  IF v_customer_id IS NULL THEN
    SELECT customer_id
    INTO v_customer_id
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to reschedule tickets.';
  END IF;

  UPDATE public.service_tickets
  SET
    locked_service_date = v_date,
    is_asap = false,
    scheduled_start = null,
    scheduled_window = null,
    scheduled_off_requested_day = false,
    customer_rescheduled = true,
    status = 'Assigned'
  WHERE id = p_ticket_id
    AND customer_id = v_customer_id
    AND (
      scheduled_start IS NOT NULL
      OR coalesce(customer_rescheduled, false) = true
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Ticket not found, or reschedule is only available after a visit is placed.';
  END IF;

  IF v_row.assigned_technician_id IS NOT NULL THEN
    v_old_number := coalesce(v_row.ticket_number, 'Ticket');
    v_title := coalesce(v_row.title, 'service request');
    BEGIN
      INSERT INTO public.notifications (technician_id, type, message, read)
      VALUES (
        v_row.assigned_technician_id,
        'customer_reschedule',
        format(
          'Customer requested reschedule of %s to %s. Place a new time in Needs scheduling: %s',
          v_old_number,
          v_date_text,
          v_title
        ),
        false
      );
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_reschedule_service_ticket(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_reschedule_service_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reschedule_service_ticket(uuid, text) TO service_role;
