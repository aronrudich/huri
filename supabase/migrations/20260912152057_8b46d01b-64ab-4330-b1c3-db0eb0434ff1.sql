DROP POLICY IF EXISTS "car events insert by active employees" ON public.car_events;
CREATE POLICY "car events insert by active employees" ON public.car_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_active_employee(auth.uid()) AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "car washes insert by active employees" ON public.car_washes;
CREATE POLICY "car washes insert by active employees" ON public.car_washes
  FOR INSERT TO authenticated
  WITH CHECK (private.is_active_employee(auth.uid()) AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "car washes update by active employees" ON public.car_washes;
CREATE POLICY "car washes update by active employees" ON public.car_washes
  FOR UPDATE TO authenticated
  USING (private.is_active_employee(auth.uid()) AND dealership_id = private.dealership_of(auth.uid()))
  WITH CHECK (private.is_active_employee(auth.uid()) AND dealership_id = private.dealership_of(auth.uid()));