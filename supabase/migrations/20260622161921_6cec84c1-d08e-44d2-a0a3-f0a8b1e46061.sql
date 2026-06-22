
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;

CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    public.is_manager(auth.uid())
    OR (
      role_name IS NOT DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid())
      AND is_active IS NOT DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_manager(auth.uid()) THEN
    IF NEW.role_name IS DISTINCT FROM OLD.role_name THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.is_active = true THEN
      RAISE EXCEPTION 'Not allowed: cannot reactivate your own account';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_escalation();
