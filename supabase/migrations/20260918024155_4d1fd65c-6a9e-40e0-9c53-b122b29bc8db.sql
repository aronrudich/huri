ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS bay_tech text;

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
    SELECT id
    FROM public.pickup_requests
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '30 minutes'
  LOOP
    UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = r.id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_tech_car_on_pickup_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_car public.parked_cars;
  v_kind text := COALESCE(NEW.kind, 'pickup');
  v_is_tech boolean := COALESCE(NEW.source_role, '') IN ('Technician', 'Shop Foreman');
  v_tech text := NULLIF(btrim(COALESCE(NEW.advisor_name, '')), '');
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
      INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, bay_tech, parked_by, dealership_id)
      VALUES (btrim(NEW.ro_number), NEW.car_model, 'BAY',
              NULLIF(btrim(COALESCE(NEW.car_notes, '')), ''), v_tech,
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
        bay_tech = COALESCE(v_tech, bay_tech)
    WHERE id = v_car.id;
  ELSE
    UPDATE public.parked_cars SET lot_position = 'TAKEN' WHERE id = v_car.id;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.car_events_from_pickups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_label text;
BEGIN
  v_label := CASE
    WHEN NEW.kind = 'parts' THEN 'Parts request'
    WHEN NEW.kind = 'shuttle' THEN 'Shuttle request'
    WHEN NEW.kind = 'park' THEN 'Park request'
    WHEN NEW.is_staged THEN 'Stage request'
    ELSE 'Pickup request'
  END;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'request',
      v_label || ' submitted' || COALESCE(' by ' || NEW.advisor_name, '')
      || COALESCE(' (' || NEW.source_role || ')', ''), NULL, COALESCE(auth.uid(), NEW.requested_by));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'canceled' OR NEW.status = 'cancelled' THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'canceled', v_label || ' canceled', NULL, auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.car_events_from_parked_cars()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'logged',
      'Added to Huri at ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, COALESCE(auth.uid(), NEW.parked_by));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'deleted',
      'Removed from Huri (was at ' || COALESCE(OLD.lot_position, 'UNKNOWN') || ')', NULL, auth.uid());
    RETURN OLD;
  ELSE
    IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'moved',
        COALESCE(OLD.lot_position, 'UNKNOWN') || ' → ' || COALESCE(NEW.lot_position, 'UNKNOWN'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.is_staged IS DISTINCT FROM OLD.is_staged AND NEW.is_staged THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'staged', 'Marked as staged', NULL, auth.uid());
    END IF;
    IF NEW.tag_number IS DISTINCT FROM OLD.tag_number THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Tag # changed from ' || COALESCE(OLD.tag_number, '—') || ' to ' || COALESCE(NEW.tag_number, '—'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.car_model IS DISTINCT FROM OLD.car_model THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Car changed from ' || COALESCE(OLD.car_model, '—') || ' to ' || COALESCE(NEW.car_model, '—'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.ro_number IS DISTINCT FROM OLD.ro_number THEN
      PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'edited',
        'RO # changed to ' || COALESCE(NEW.ro_number, '—'), NULL, COALESCE(auth.uid(), NEW.parked_by));
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'RO # changed from ' || COALESCE(OLD.ro_number, '—'), NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    RETURN NEW;
  END IF;
END $function$;