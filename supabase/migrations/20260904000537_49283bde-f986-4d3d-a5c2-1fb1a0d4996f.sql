ALTER TABLE public.parked_cars
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flag_dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS parked_cars_flagged_idx
  ON public.parked_cars (dealership_id, flagged_at);

CREATE OR REPLACE FUNCTION public.record_wash_on_leaving_wash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF upper(btrim(COALESCE(OLD.lot_position, ''))) = 'WASH'
     AND upper(btrim(COALESCE(NEW.lot_position, ''))) IN ('CP', 'BL')
     AND NEW.ro_number IS NOT NULL AND btrim(NEW.ro_number) <> '' THEN

    SELECT role_name INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF COALESCE(v_role, '') <> 'Car Wash' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.car_washes (dealership_id, ro_number, washed_at, washed_by)
    VALUES (COALESCE(NEW.dealership_id, '00000000-0000-0000-0000-000000000001'::uuid),
            btrim(NEW.ro_number), now(), auth.uid())
    ON CONFLICT (dealership_id, ro_number)
    DO UPDATE SET washed_at = now(), washed_by = COALESCE(auth.uid(), public.car_washes.washed_by);

    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'washed',
      'Washed — moved from Wash to ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, auth.uid());
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.track_car_location_age()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
    NEW.located_at := now();
    NEW.stale_alerted_at := NULL;
    NEW.flagged_at := NULL;
    NEW.flag_dismissed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

SELECT cron.alter_job(5, schedule := '5 12,13 * * *');