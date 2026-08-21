CREATE OR REPLACE FUNCTION private.is_suspended(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND role_name IN ('Service Manager')
  )
$$;
REVOKE ALL ON FUNCTION private.is_suspended(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_suspended(uuid) TO authenticated, service_role;

-- Suspended roles keep read access but can no longer write anything.
CREATE OR REPLACE FUNCTION private.is_active_employee(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND is_active = true AND role_name NOT IN ('Service Manager')
  )
$$;

CREATE OR REPLACE FUNCTION private.is_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND role_name = 'Manager' AND is_active = true
  )
$$;

DROP POLICY IF EXISTS "messages insert approved" ON public.messages;
CREATE POLICY "messages insert approved" ON public.messages
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    private.is_approved(auth.uid())
    AND sender_id = auth.uid()
    AND NOT private.is_suspended(auth.uid())
  );