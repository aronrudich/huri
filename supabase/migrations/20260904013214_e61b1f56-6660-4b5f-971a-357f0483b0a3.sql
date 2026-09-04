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