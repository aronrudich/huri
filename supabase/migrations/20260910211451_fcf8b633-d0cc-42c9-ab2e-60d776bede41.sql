-- 1. Claim no longer changes the car or overwrites the submit-time location snapshot
CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
 RETURNS pickup_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_request public.pickup_requests;
  v_car public.parked_cars;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_active_employee(auth.uid()) OR NOT private.is_approved(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_request FROM public.pickup_requests
    WHERE id = _pickup_id AND status = 'unclaimed'
      AND dealership_id = private.dealership_of(auth.uid()) FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Pickup is no longer available'; END IF;

  IF v_request.ro_number IS NOT NULL THEN
    SELECT * INTO v_car FROM public.parked_cars
      WHERE dealership_id = v_request.dealership_id AND ro_number = v_request.ro_number FOR UPDATE;
  END IF;

  UPDATE public.pickup_requests
  SET status = 'claimed', claimed_by = auth.uid(), claimed_at = now(),
      lot_position = COALESCE(v_request.lot_position, 'UNKNOWN'),
      car_model = COALESCE(v_request.car_model, v_car.car_model)
  WHERE id = v_request.id RETURNING * INTO v_request;

  RETURN v_request;
END;
$function$;

-- 2. Single handler applied when a submission leaves the list (status -> completed)
CREATE OR REPLACE FUNCTION public.add_tech_car_on_pickup_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_car public.parked_cars;
  v_notes text;
  v_kind text := COALESCE(NEW.kind, 'pickup');
  v_is_tech boolean := COALESCE(NEW.source_role, '') IN ('Technician', 'Shop Foreman');
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF v_kind IN ('parts', 'shuttle', 'park') THEN
    RETURN NEW;
  END IF;

  IF NEW.ro_number IS NULL OR btrim(NEW.ro_number) = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_car
  FROM public.parked_cars
  WHERE dealership_id = NEW.dealership_id
    AND ro_number = btrim(NEW.ro_number)
  ORDER BY created_at
  LIMIT 1;

  -- Car not in Huri yet: only technician pickups create one, at the bay
  IF v_car.id IS NULL THEN
    IF v_kind = 'pickup' AND v_is_tech THEN
      v_notes := NULLIF(btrim(COALESCE(NEW.car_notes, '')), '');
      IF NEW.advisor_name IS NOT NULL AND btrim(NEW.advisor_name) <> '' THEN
        v_notes := COALESCE(v_notes || ' — ', '') || 'Bay — ' || btrim(NEW.advisor_name);
      END IF;

      INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, parked_by, dealership_id)
      VALUES (btrim(NEW.ro_number), NEW.car_model, 'BAY', v_notes,
              COALESCE(NEW.claimed_by, NEW.requested_by), NEW.dealership_id);
    END IF;
    RETURN NEW;
  END IF;

  -- Someone re-parked the car after it was claimed: their location wins
  IF NEW.claimed_at IS NOT NULL AND v_car.located_at > NEW.claimed_at THEN
    RETURN NEW;
  END IF;

  IF v_kind = 'wash' THEN
    UPDATE public.parked_cars SET lot_position = 'WASH' WHERE id = v_car.id;
  ELSIF NEW.is_staged THEN
    UPDATE public.parked_cars SET lot_position = 'CP', is_staged = false WHERE id = v_car.id;
  ELSIF v_is_tech THEN
    UPDATE public.parked_cars
    SET lot_position = 'BAY',
        notes = CASE WHEN NEW.advisor_name IS NULL OR btrim(NEW.advisor_name) = ''
                     THEN notes ELSE 'Bay — ' || btrim(NEW.advisor_name) END
    WHERE id = v_car.id;
  ELSE
    UPDATE public.parked_cars SET lot_position = 'UNKNOWN' WHERE id = v_car.id;
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.add_tech_car_on_pickup_complete() FROM PUBLIC, anon, authenticated;