ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text;

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
    SELECT id, ro_number, is_staged, kind, source_role, advisor_name
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
    ELSIF NOT r.is_staged
      AND r.kind IS DISTINCT FROM 'parts'
      AND r.ro_number IS NOT NULL
      AND r.source_role IN ('Technician', 'Shop Foreman')
    THEN
      UPDATE public.parked_cars
      SET lot_position = 'BAY',
          notes = CASE
            WHEN r.advisor_name IS NULL OR btrim(r.advisor_name) = '' THEN notes
            ELSE 'Bay — ' || r.advisor_name
          END
      WHERE ro_number = r.ro_number;
    END IF;
  END LOOP;
END;
$function$;