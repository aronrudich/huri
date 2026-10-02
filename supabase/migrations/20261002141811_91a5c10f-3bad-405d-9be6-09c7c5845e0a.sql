ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS notes_updated_at timestamptz;
UPDATE public.parked_cars SET notes_updated_at = created_at WHERE notes_updated_at IS NULL;
ALTER TABLE public.parked_cars ALTER COLUMN notes_updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.stamp_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.notes_updated_at := COALESCE(NEW.notes_updated_at, now());
  ELSIF NEW.notes IS DISTINCT FROM OLD.notes THEN
    NEW.notes_updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS parked_cars_stamp_notes ON public.parked_cars;
CREATE TRIGGER parked_cars_stamp_notes BEFORE INSERT OR UPDATE ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.stamp_notes_updated_at();

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
      -- Submission notes are temporary and stay on the request only.
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
END $$;