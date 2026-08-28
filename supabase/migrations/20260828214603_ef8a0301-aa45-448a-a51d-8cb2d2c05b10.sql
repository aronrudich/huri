CREATE OR REPLACE FUNCTION private.is_active_employee(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND is_active = true
  )
$$;

DROP POLICY IF EXISTS "messages insert approved" ON public.messages;
CREATE POLICY "messages insert approved" ON public.messages
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    private.is_approved(auth.uid())
    AND sender_id = auth.uid()
  );

DROP FUNCTION IF EXISTS private.is_suspended(uuid);