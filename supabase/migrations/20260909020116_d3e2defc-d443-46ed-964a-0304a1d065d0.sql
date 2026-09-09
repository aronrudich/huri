CREATE TABLE public.car_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.dealerships(id),
  ro_number text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX car_photos_ro_idx ON public.car_photos (dealership_id, ro_number, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.car_photos TO authenticated;
GRANT ALL ON public.car_photos TO service_role;

ALTER TABLE public.car_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car photos readable by tenant" ON public.car_photos
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));

CREATE POLICY "car photos insert by active employees" ON public.car_photos
FOR INSERT TO authenticated
WITH CHECK (
  private.is_active_employee(auth.uid())
  AND private.is_approved(auth.uid())
  AND NOT private.is_spectator(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "car photos delete by active employees" ON public.car_photos
FOR DELETE TO authenticated
USING (
  private.is_active_employee(auth.uid())
  AND private.is_approved(auth.uid())
  AND NOT private.is_spectator(auth.uid())
  AND dealership_id = private.dealership_of(auth.uid())
);

CREATE TRIGGER car_photos_set_dealership BEFORE INSERT ON public.car_photos
FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

CREATE POLICY "car photos storage read" ON storage.objects
FOR SELECT USING (bucket_id = 'car-photos' AND private.is_approved(auth.uid()));

CREATE POLICY "car photos storage insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'car-photos'
  AND private.is_active_employee(auth.uid())
  AND private.is_approved(auth.uid())
  AND NOT private.is_spectator(auth.uid())
);

CREATE POLICY "car photos storage delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'car-photos'
  AND private.is_active_employee(auth.uid())
  AND private.is_approved(auth.uid())
  AND NOT private.is_spectator(auth.uid())
);