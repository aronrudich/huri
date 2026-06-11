
-- 1) Security definer helper: is current user a Manager?
CREATE OR REPLACE FUNCTION public.is_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND role_name = 'Manager' AND is_active = true
  )
$$;

-- 2) Restrict full profile SELECT to owner + managers
DROP POLICY IF EXISTS "profiles readable by auth" ON public.profiles;
CREATE POLICY "profiles self or manager read"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_manager(auth.uid()));

-- 3) Public directory view: safe columns only, readable by all authenticated users
CREATE OR REPLACE VIEW public.directory
WITH (security_invoker = true) AS
SELECT id, full_name, nickname, role_name, role_id, is_active, created_at
FROM public.profiles;

GRANT SELECT ON public.directory TO authenticated;

-- 4) Lock down roles INSERT (was WITH CHECK true)
DROP POLICY IF EXISTS "auth can add roles" ON public.roles;
CREATE POLICY "managers can add roles"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.is_manager(auth.uid()));

-- 5) Add basic RLS policies on realtime.messages so channel subscriptions
-- are restricted to authenticated users (default-deny was effectively open
-- because no policy means broker fallback). Scope topic access to auth users.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated can receive broadcasts" ON realtime.messages';
    EXECUTE 'CREATE POLICY "authenticated can receive broadcasts" ON realtime.messages FOR SELECT TO authenticated USING (true)';
  END IF;
END$$;
