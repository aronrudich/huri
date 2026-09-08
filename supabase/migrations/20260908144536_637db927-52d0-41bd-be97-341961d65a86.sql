CREATE OR REPLACE FUNCTION public.add_tech_car_on_pickup_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exists uuid;
  v_notes text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.kind, 'pickup') IN ('parts', 'shuttle') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.source_role, '') NOT IN ('Technician', 'Shop Foreman') THEN
    RETURN NEW;
  END IF;

  IF NEW.ro_number IS NULL OR btrim(NEW.ro_number) = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_exists
  FROM public.parked_cars
  WHERE dealership_id = NEW.dealership_id
    AND ro_number = btrim(NEW.ro_number)
  LIMIT 1;

  IF v_exists IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_notes := NULLIF(btrim(COALESCE(NEW.car_notes, '')), '');
  IF NEW.advisor_name IS NOT NULL AND btrim(NEW.advisor_name) <> '' THEN
    v_notes := COALESCE(v_notes || ' — ', '') || 'Bay — ' || btrim(NEW.advisor_name);
  END IF;

  INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, parked_by, dealership_id)
  VALUES (btrim(NEW.ro_number), NEW.car_model, 'BAY', v_notes,
          COALESCE(NEW.claimed_by, NEW.requested_by), NEW.dealership_id);

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS pickup_requests_add_tech_car ON public.pickup_requests;

CREATE TRIGGER pickup_requests_add_tech_car
AFTER UPDATE ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.add_tech_car_on_pickup_complete();