CREATE OR REPLACE FUNCTION public.clear_bay_tech_off_bay()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lot_position IS DISTINCT FROM 'BAY' THEN
    NEW.bay_tech := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parked_cars_clear_bay_tech ON public.parked_cars;
CREATE TRIGGER parked_cars_clear_bay_tech
BEFORE INSERT OR UPDATE ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.clear_bay_tech_off_bay();

UPDATE public.parked_cars SET bay_tech = NULL
WHERE bay_tech IS NOT NULL AND lot_position IS DISTINCT FROM 'BAY';