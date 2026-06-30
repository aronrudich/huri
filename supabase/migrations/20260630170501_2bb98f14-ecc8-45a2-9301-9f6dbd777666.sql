
-- Remove anonymous messaging vestige
ALTER TABLE public.messages DROP COLUMN IF EXISTS is_anonymous;

-- Tighten profile self-update: prevent is_owner escalation
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (is_owner IS DISTINCT FROM (SELECT p.is_owner FROM public.profiles p WHERE p.id = auth.uid()))
  AND (
    private.is_manager(auth.uid())
    OR (
      NOT (role_name IS DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid()))
      AND NOT (is_active IS DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
    )
  )
);
