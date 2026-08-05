-- Client user profile/settings: contact fields + additional contacts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS communication_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  relationship text,
  preferred_contact boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_contacts_profile_id_idx
  ON public.client_contacts (profile_id);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_contacts_select_own" ON public.client_contacts;
CREATE POLICY "client_contacts_select_own"
  ON public.client_contacts FOR SELECT
  USING (profile_id = auth.uid() OR app_private.is_admin());

DROP POLICY IF EXISTS "client_contacts_insert_own" ON public.client_contacts;
CREATE POLICY "client_contacts_insert_own"
  ON public.client_contacts FOR INSERT
  WITH CHECK (profile_id = auth.uid() OR app_private.is_admin());

DROP POLICY IF EXISTS "client_contacts_update_own" ON public.client_contacts;
CREATE POLICY "client_contacts_update_own"
  ON public.client_contacts FOR UPDATE
  USING (profile_id = auth.uid() OR app_private.is_admin())
  WITH CHECK (profile_id = auth.uid() OR app_private.is_admin());

DROP POLICY IF EXISTS "client_contacts_delete_own" ON public.client_contacts;
CREATE POLICY "client_contacts_delete_own"
  ON public.client_contacts FOR DELETE
  USING (profile_id = auth.uid() OR app_private.is_admin());
