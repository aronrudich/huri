INSERT INTO public.roles (name, is_group)
SELECT 'Spectator', false
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'Spectator');

CREATE OR REPLACE FUNCTION private.is_spectator(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _uid AND role_name = 'Spectator'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_active_employee(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND is_active = true AND role_name <> 'Spectator'
  )
$$;

DROP POLICY IF EXISTS "messages insert approved" ON public.messages;
CREATE POLICY "messages insert approved" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_approved(auth.uid())
    AND NOT private.is_spectator(auth.uid())
    AND sender_id = auth.uid()
  );