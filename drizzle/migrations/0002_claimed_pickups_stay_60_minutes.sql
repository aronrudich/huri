CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pickup_requests
    WHERE status = 'claimed' AND claimed_at <= now() - interval '60 minutes'
  LOOP
    UPDATE public.pickup_requests SET status = 'completed', completed_at = COALESCE(completed_at, now()) WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.dealerships ALTER COLUMN claim_hide_minutes SET DEFAULT 60;
UPDATE public.dealerships SET claim_hide_minutes = 60 WHERE claim_hide_minutes = 30;