-- 1. Dealership is derived from the caller, never silently defaulted.
CREATE OR REPLACE FUNCTION public.set_dealership_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NEW.dealership_id IS NULL THEN
    NEW.dealership_id := private.dealership_of(auth.uid());
  END IF;
  IF NEW.dealership_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine dealership for this record';
  END IF;
  RETURN NEW;
END
$function$;

ALTER TABLE public.parked_cars ALTER COLUMN dealership_id DROP DEFAULT;
ALTER TABLE public.pickup_requests ALTER COLUMN dealership_id DROP DEFAULT;
ALTER TABLE public.messages ALTER COLUMN dealership_id DROP DEFAULT;
ALTER TABLE public.car_photos ALTER COLUMN dealership_id DROP DEFAULT;
ALTER TABLE public.car_events ALTER COLUMN dealership_id DROP DEFAULT;
ALTER TABLE public.car_washes ALTER COLUMN dealership_id DROP DEFAULT;

DROP TRIGGER IF EXISTS car_events_set_dealership ON public.car_events;
CREATE TRIGGER car_events_set_dealership
  BEFORE INSERT ON public.car_events
  FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

DROP TRIGGER IF EXISTS car_washes_set_dealership ON public.car_washes;
CREATE TRIGGER car_washes_set_dealership
  BEFORE INSERT ON public.car_washes
  FOR EACH ROW EXECUTE FUNCTION public.set_dealership_from_user();

-- 2. Retire the global RO uniqueness rule; the per-dealership one stays.
DROP INDEX IF EXISTS public.parked_cars_ro_unique;

-- 3. Retire the duplicate numbered-spot uniqueness rule.
DROP INDEX IF EXISTS public.parked_cars_unique_sv_spot;