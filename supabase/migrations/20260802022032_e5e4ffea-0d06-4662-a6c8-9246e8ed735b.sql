-- 1) Enforce on UPDATE: no self role change, no self reactivation, no self ownership grab.
CREATE OR REPLACE FUNCTION private.prevent_profile_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id AND NOT private.is_manager(auth.uid()) AND NOT private.is_owner(auth.uid()) THEN
    IF NEW.role_name IS DISTINCT FROM OLD.role_name THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own role';
    END IF;
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own active status';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own approval status';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT private.is_owner(auth.uid()) AND NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
    RAISE EXCEPTION 'Not allowed: only the owner can transfer ownership';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.prevent_profile_self_escalation();

-- 2) Enforce on INSERT: a self-registration cannot claim a privileged role or ownership.
CREATE OR REPLACE FUNCTION private.sanitize_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  privileged text[] := ARRAY['Manager','Service Manager','Service Director','General Manager','Director'];
BEGIN
  -- Only constrain rows a user creates for themselves; privileged/service-role paths are untouched.
  IF auth.uid() IS NULL OR auth.uid() <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF NEW.is_owner IS TRUE THEN
    NEW.is_owner := false;
  END IF;

  IF NEW.role_name = ANY (privileged) THEN
    NEW.pending_role_name := NEW.role_name;
    NEW.role_name := 'Employee';
    NEW.role_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_profile_insert ON public.profiles;
CREATE TRIGGER sanitize_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.sanitize_profile_insert();

-- 3) Tighten the update policy itself so the columns are also blocked at the policy layer.
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (is_owner IS DISTINCT FROM (SELECT p.is_owner FROM public.profiles p WHERE p.id = auth.uid()))
  AND (
    private.is_manager(auth.uid())
    OR private.is_owner(auth.uid())
    OR (
      NOT (role_name IS DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid()))
      AND NOT (is_active IS DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
      AND NOT (status IS DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))
    )
  )
);