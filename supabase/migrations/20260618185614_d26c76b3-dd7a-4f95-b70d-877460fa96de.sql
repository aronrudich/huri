DROP POLICY IF EXISTS "profiles self or manager read" ON public.profiles;
CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);