-- Sequential service ticket numbers: TKT-0001, TKT-0002, …
-- Renumbers all existing rows by opened_at, then id.

CREATE SEQUENCE IF NOT EXISTS public.service_ticket_number_seq;

-- Drop unique constraint/index if present so renumber can overwrite freely.
ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_ticket_number_key;

DROP INDEX IF EXISTS public.service_tickets_ticket_number_key;
DROP INDEX IF EXISTS public.service_tickets_ticket_number_idx;

WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY opened_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.service_tickets
)
UPDATE public.service_tickets AS st
SET ticket_number = 'TKT-' || lpad(ordered.rn::text, 4, '0')
FROM ordered
WHERE st.id = ordered.id;

SELECT setval(
  'public.service_ticket_number_seq',
  GREATEST(
    (SELECT COUNT(*)::bigint FROM public.service_tickets),
    1
  ),
  (SELECT COUNT(*) > 0 FROM public.service_tickets)
);

CREATE OR REPLACE FUNCTION public.next_service_ticket_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  width int;
BEGIN
  n := nextval('public.service_ticket_number_seq');
  width := GREATEST(4, length(n::text));
  RETURN 'TKT-' || lpad(n::text, width, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_service_ticket_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_service_ticket_number() TO anon;
GRANT EXECUTE ON FUNCTION public.next_service_ticket_number() TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS service_tickets_ticket_number_key
  ON public.service_tickets (ticket_number);
