DROP POLICY IF EXISTS "roles readable by all" ON public.roles;
CREATE POLICY "roles readable by signed-in users" ON public.roles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);