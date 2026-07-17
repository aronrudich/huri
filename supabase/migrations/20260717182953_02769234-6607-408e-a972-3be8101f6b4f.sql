
-- Replace the unique constraint so multi-car placeholders (C, T, UNKNOWN) are allowed.
ALTER TABLE public.parked_cars
  DROP CONSTRAINT IF EXISTS parked_cars_one_car_per_real_spot_per_dealership;
DROP INDEX IF EXISTS public.parked_cars_one_car_per_real_spot_per_dealership;

CREATE UNIQUE INDEX parked_cars_one_car_per_numbered_spot
  ON public.parked_cars (dealership_id, upper(lot_position))
  WHERE upper(lot_position) NOT IN ('C','T','UNKNOWN');

-- New spot grammar.
CREATE OR REPLACE FUNCTION public.validate_spot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v text;
  n int;
BEGIN
  IF NEW.lot_position IS NULL OR NEW.lot_position = '' THEN
    NEW.lot_position := 'T';
    RETURN NEW;
  END IF;

  v := upper(NEW.lot_position);
  NEW.lot_position := v;

  IF v IN ('UNKNOWN','T','C') THEN
    RETURN NEW;
  END IF;

  IF v ~ '^[0-9]+$' THEN
    n := v::int;
    IF n = 0 THEN
      NEW.lot_position := 'T';
      RETURN NEW;
    END IF;
    IF n < 1 OR n > 147 THEN
      RAISE EXCEPTION 'Lot 1 spot must be 1..147, got %', v;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Spot must be 1-147, C, T, or UNKNOWN, got %', NEW.lot_position;
END;
$function$;

-- Migrate legacy values.
UPDATE public.parked_cars SET lot_position = 'T'
  WHERE lot_position IN ('0','UNKNOWN','') OR lot_position IS NULL;
UPDATE public.parked_cars SET lot_position = 'C'
  WHERE lot_position ~ '^C[0-9]+$';

UPDATE public.pickup_requests SET lot_position = 'T'
  WHERE lot_position IN ('0','UNKNOWN','') OR lot_position IS NULL;
UPDATE public.pickup_requests SET lot_position = 'C'
  WHERE lot_position ~ '^C[0-9]+$';

-- Cron: 60-minute auto-archive runs every minute.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'huri-archive-stale-pickups') THEN
    PERFORM cron.unschedule('huri-archive-stale-pickups');
  END IF;
  PERFORM cron.schedule('huri-archive-stale-pickups', '* * * * *', $cron$ SELECT public.archive_stale_pickups(); $cron$);
END $$;
