
-- 1) Private schema for helper functions (not exposed by PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 2) Move is_manager into private
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
REVOKE ALL ON FUNCTION private.is_manager(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_manager(uuid) TO authenticated, service_role;

-- 3) Helper: is the caller an active employee?
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
REVOKE ALL ON FUNCTION private.is_active_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active_employee(uuid) TO authenticated, service_role;

-- 4) Move trigger function into private
CREATE OR REPLACE FUNCTION private.prevent_profile_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT private.is_manager(auth.uid()) THEN
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
REVOKE ALL ON FUNCTION private.prevent_profile_self_escalation() FROM PUBLIC, anon, authenticated;

-- 5) Re-point trigger to private function
DROP TRIGGER IF EXISTS prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.prevent_profile_self_escalation();

-- 6) Tighten profiles SELECT — own row OR manager (hides email/sensitive cols)
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles self or manager read" ON public.profiles;
CREATE POLICY "profiles self or manager read"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR private.is_manager(auth.uid()));

-- 7) Re-create UPDATE policy using private.is_manager
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    private.is_manager(auth.uid())
    OR (
      role_name IS NOT DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid())
      AND is_active IS NOT DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

-- 8) Re-point roles INSERT policy
DROP POLICY IF EXISTS "managers can add roles" ON public.roles;
CREATE POLICY "managers can add roles"
ON public.roles FOR INSERT TO authenticated
WITH CHECK (private.is_manager(auth.uid()));

-- 9) Drop public-schema copies of the helper functions
DROP FUNCTION IF EXISTS public.prevent_profile_self_escalation();
DROP FUNCTION IF EXISTS public.is_manager(uuid);

-- 10) Directory view: bypass RLS so non-managers can still see safe columns of all employees
DROP VIEW IF EXISTS public.directory;
CREATE VIEW public.directory
WITH (security_invoker = false) AS
SELECT id, full_name, nickname, role_name, role_id, is_active, created_at
FROM public.profiles;
ALTER VIEW public.directory OWNER TO postgres;
GRANT SELECT ON public.directory TO authenticated;

-- 11) Replace always-true write policies with active-employee scope
DROP POLICY IF EXISTS "parked_cars insert by auth"  ON public.parked_cars;
DROP POLICY IF EXISTS "parked_cars update by auth"  ON public.parked_cars;
DROP POLICY IF EXISTS "parked_cars delete by auth"  ON public.parked_cars;
CREATE POLICY "parked_cars insert by active employees" ON public.parked_cars
  FOR INSERT TO authenticated WITH CHECK (private.is_active_employee(auth.uid()));
CREATE POLICY "parked_cars update by active employees" ON public.parked_cars
  FOR UPDATE TO authenticated
  USING (private.is_active_employee(auth.uid()))
  WITH CHECK (private.is_active_employee(auth.uid()));
CREATE POLICY "parked_cars delete by active employees" ON public.parked_cars
  FOR DELETE TO authenticated USING (private.is_active_employee(auth.uid()));

DROP POLICY IF EXISTS "pickups insert by auth" ON public.pickup_requests;
DROP POLICY IF EXISTS "pickups update by auth" ON public.pickup_requests;
CREATE POLICY "pickups insert by active employees" ON public.pickup_requests
  FOR INSERT TO authenticated WITH CHECK (private.is_active_employee(auth.uid()));
CREATE POLICY "pickups update by active employees" ON public.pickup_requests
  FOR UPDATE TO authenticated
  USING (private.is_active_employee(auth.uid()))
  WITH CHECK (private.is_active_employee(auth.uid()));
