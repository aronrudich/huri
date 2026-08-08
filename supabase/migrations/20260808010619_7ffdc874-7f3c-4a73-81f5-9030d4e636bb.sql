CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, ro_number, is_staged, kind
    FROM public.pickup_requests
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '60 minutes'
  LOOP
    UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = r.id;

    IF r.is_staged AND r.kind IS DISTINCT FROM 'parts' AND r.ro_number IS NOT NULL THEN
      UPDATE public.parked_cars
      SET lot_position = 'CP', is_staged = false
      WHERE ro_number = r.ro_number;
    END IF;
  END LOOP;
END;
$function$;