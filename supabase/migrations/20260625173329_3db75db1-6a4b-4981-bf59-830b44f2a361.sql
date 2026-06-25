
-- Make tag_number optional; RO# is now the identifying field
ALTER TABLE public.parked_cars ALTER COLUMN tag_number DROP NOT NULL;
ALTER TABLE public.parked_cars DROP CONSTRAINT IF EXISTS parked_cars_tag_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS parked_cars_ro_unique ON public.parked_cars (ro_number) WHERE ro_number IS NOT NULL;

-- Auto-archive pickups after 60 minutes (was 45) and match parked car by RO# (fallback to tag)
CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.parked_cars pc SET lot_position = 'UNKNOWN'
    FROM public.pickup_requests pr
    WHERE pr.status = 'claimed'
      AND pr.claimed_at < now() - interval '60 minutes'
      AND (
        (pr.ro_number IS NOT NULL AND pc.ro_number = pr.ro_number)
        OR (pr.ro_number IS NULL AND pr.tag_number IS NOT NULL AND pc.tag_number = pr.tag_number)
      );
  UPDATE public.pickup_requests
    SET status = 'completed', completed_at = now()
    WHERE status = 'claimed' AND claimed_at < now() - interval '60 minutes';
END; $function$;
