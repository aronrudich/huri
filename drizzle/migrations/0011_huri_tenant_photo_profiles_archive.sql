ALTER POLICY "profiles read" ON public.profiles USING ((id = auth.uid()) OR (private.is_owner(auth.uid()) AND dealership_id = private.dealership_of(auth.uid())) OR (private.is_approved(auth.uid()) AND status = 'approved' AND is_active = true AND dealership_id = private.dealership_of(auth.uid())));
CREATE OR REPLACE FUNCTION private.photo_path_in_my_dealership(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
 SELECT CASE WHEN array_length(storage.foldername(_name), 1) = 2 THEN
   (storage.foldername(_name))[1] = private.dealership_of(auth.uid())::text
 WHEN array_length(storage.foldername(_name), 1) = 1 THEN EXISTS (
   SELECT 1 FROM public.car_photos cp WHERE cp.dealership_id = private.dealership_of(auth.uid())
     AND (_name = cp.storage_path OR _name = regexp_replace(cp.storage_path, '\.jpg$', '_thumb.jpg', 'i'))
 ) ELSE false END
$$;
CREATE OR REPLACE FUNCTION public.archive_stale_pickups() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.pickup_requests r SET status = 'completed', completed_at = COALESCE(r.completed_at, now())
 FROM public.dealerships d WHERE r.dealership_id = d.id AND r.status = 'claimed'
 AND r.claimed_at <= now() - COALESCE(d.claim_hide_minutes,60) * interval '1 minute';
END $$;