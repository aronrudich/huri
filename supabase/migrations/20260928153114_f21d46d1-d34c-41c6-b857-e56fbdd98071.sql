CREATE OR REPLACE FUNCTION public.car_events_from_parked_cars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := CASE WHEN current_setting('huri.system_move', true) = 'on' THEN NULL ELSE auth.uid() END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'logged',
      'Added to Huri at ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, v_actor);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'deleted',
      'Removed from Huri (was at ' || COALESCE(OLD.lot_position, 'UNKNOWN') || ')', NULL, v_actor);
    RETURN OLD;
  ELSE
    IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'moved',
        COALESCE(OLD.lot_position, 'UNKNOWN') || ' → ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, v_actor);
    END IF;
    IF NEW.is_staged IS DISTINCT FROM OLD.is_staged AND NEW.is_staged THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'staged', 'Marked as staged', NULL, v_actor);
    END IF;
    IF NEW.tag_number IS DISTINCT FROM OLD.tag_number THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Tag # changed from ' || COALESCE(OLD.tag_number, '—') || ' to ' || COALESCE(NEW.tag_number, '—'), NULL, v_actor);
    END IF;
    IF NEW.car_model IS DISTINCT FROM OLD.car_model THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Car changed from ' || COALESCE(OLD.car_model, '—') || ' to ' || COALESCE(NEW.car_model, '—'), NULL, v_actor);
    END IF;
    IF NEW.ro_number IS DISTINCT FROM OLD.ro_number THEN
      PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'edited',
        'RO # changed to ' || COALESCE(NEW.ro_number, '—'), NULL, v_actor);
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'RO # changed from ' || COALESCE(OLD.ro_number, '—'), NULL, v_actor);
    END IF;
    RETURN NEW;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.add_tech_car_on_pickup_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_car public.parked_cars;
  v_kind text := COALESCE(NEW.kind, 'pickup');
  v_is_tech boolean := COALESCE(NEW.source_role, '') IN ('Technician', 'Shop Foreman');
  v_tech text := NULLIF(btrim(COALESCE(NEW.advisor_name, '')), '');
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  IF v_kind IN ('parts', 'shuttle', 'park') THEN RETURN NEW; END IF;
  IF NEW.ro_number IS NULL OR btrim(NEW.ro_number) = '' THEN RETURN NEW; END IF;

  SELECT * INTO v_car FROM public.parked_cars
  WHERE dealership_id = NEW.dealership_id AND ro_number = btrim(NEW.ro_number)
  ORDER BY created_at LIMIT 1;

  PERFORM set_config('huri.system_move', 'on', true);

  IF v_car.id IS NULL THEN
    IF v_kind = 'pickup' AND v_is_tech THEN
      INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, bay_tech, parked_by, dealership_id)
      VALUES (btrim(NEW.ro_number), NEW.car_model, 'BAY',
              NULLIF(btrim(COALESCE(NEW.car_notes, '')), ''), v_tech, NULL, NEW.dealership_id);
    END IF;
  ELSIF NEW.claimed_at IS NOT NULL AND v_car.located_at > NEW.claimed_at THEN
    NULL; -- someone re-parked it after claim; their location wins
  ELSIF v_kind = 'wash' THEN
    UPDATE public.parked_cars SET lot_position = 'WASH' WHERE id = v_car.id;
  ELSIF NEW.is_staged THEN
    UPDATE public.parked_cars SET lot_position = 'CP', is_staged = false WHERE id = v_car.id;
  ELSIF v_is_tech THEN
    UPDATE public.parked_cars SET lot_position = 'BAY', bay_tech = COALESCE(v_tech, bay_tech) WHERE id = v_car.id;
  ELSE
    UPDATE public.parked_cars SET lot_position = 'TAKEN' WHERE id = v_car.id;
  END IF;

  PERFORM set_config('huri.system_move', 'off', true);
  RETURN NEW;
END $$;