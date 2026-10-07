CREATE OR REPLACE FUNCTION public.add_tech_car_on_pickup_complete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_car public.parked_cars;
  v_kind text := COALESCE(NEW.kind, 'pickup');
  v_is_tech boolean := COALESCE(NEW.source_role, '') IN ('Technician', 'Shop Foreman');
  v_tech text := NULLIF(btrim(COALESCE(NEW.advisor_name, '')), '');
  v_apply boolean;
  v_restore boolean;
  v_snap text := NULLIF(upper(btrim(COALESCE(NEW.lot_position, ''))), '');
BEGIN
  -- Apply destination on claim (or on a direct unclaimed -> completed jump).
  v_apply := (NEW.status = 'claimed' AND OLD.status = 'unclaimed')
          OR (NEW.status = 'completed' AND OLD.status = 'unclaimed');
  -- Restore the card's spot when a claim is undone or a claimed request is canceled.
  v_restore := OLD.status = 'claimed' AND NEW.status IN ('unclaimed', 'canceled', 'cancelled');
  IF NOT v_apply AND NOT v_restore THEN RETURN NEW; END IF;
  IF v_kind IN ('parts', 'shuttle', 'park') THEN RETURN NEW; END IF;
  IF NEW.ro_number IS NULL OR btrim(NEW.ro_number) = '' THEN RETURN NEW; END IF;

  SELECT * INTO v_car FROM public.parked_cars
  WHERE dealership_id = NEW.dealership_id AND ro_number = btrim(NEW.ro_number)
  ORDER BY created_at LIMIT 1;

  PERFORM set_config('huri.system_move', 'on', true);

  IF v_restore THEN
    IF v_car.id IS NOT NULL AND OLD.claimed_at IS NOT NULL
       AND v_car.located_at <= OLD.claimed_at + interval '5 seconds'
       AND upper(COALESCE(v_car.lot_position, '')) IN ('BAY', 'TAKEN', 'CP', 'WASH')
       AND v_snap IS NOT NULL AND v_snap <> upper(v_car.lot_position) THEN
      UPDATE public.parked_cars
      SET lot_position = v_snap,
          bay_tech = CASE WHEN upper(v_car.lot_position) = 'BAY' THEN NULL ELSE bay_tech END,
          is_staged = CASE WHEN NEW.is_staged THEN true ELSE is_staged END
      WHERE id = v_car.id;
    END IF;
  ELSIF v_car.id IS NULL THEN
    IF v_kind = 'pickup' AND v_is_tech THEN
      INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, bay_tech, parked_by, dealership_id)
      VALUES (btrim(NEW.ro_number), NEW.car_model, 'BAY', NULL, v_tech, NULL, NEW.dealership_id);
    END IF;
  ELSIF NEW.claimed_at IS NOT NULL AND v_car.located_at > NEW.claimed_at THEN
    NULL;
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
END $function$;