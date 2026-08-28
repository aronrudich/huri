INSERT INTO public.roles (name, is_group) VALUES ('Car Wash', true) ON CONFLICT (name) DO NOTHING;

CREATE TABLE public.car_washes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.dealerships(id),
  ro_number text NOT NULL,
  washed_at timestamp with time zone NOT NULL DEFAULT now(),
  washed_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, ro_number)
);

GRANT SELECT, INSERT, UPDATE ON public.car_washes TO authenticated;
GRANT ALL ON public.car_washes TO service_role;

ALTER TABLE public.car_washes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car washes readable by tenant" ON public.car_washes
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()));

CREATE POLICY "car washes insert by active employees" ON public.car_washes
FOR INSERT TO authenticated WITH CHECK (private.is_active_employee(auth.uid()));

CREATE POLICY "car washes update by active employees" ON public.car_washes
FOR UPDATE TO authenticated USING (private.is_active_employee(auth.uid())) WITH CHECK (private.is_active_employee(auth.uid()));

CREATE TRIGGER car_washes_touch BEFORE UPDATE ON public.car_washes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.record_wash_on_leaving_wash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF upper(btrim(COALESCE(OLD.lot_position, ''))) = 'WASH'
     AND upper(btrim(COALESCE(NEW.lot_position, ''))) <> 'WASH'
     AND NEW.ro_number IS NOT NULL AND btrim(NEW.ro_number) <> '' THEN
    INSERT INTO public.car_washes (dealership_id, ro_number, washed_at, washed_by)
    VALUES (COALESCE(NEW.dealership_id, '00000000-0000-0000-0000-000000000001'::uuid),
            btrim(NEW.ro_number), now(), auth.uid())
    ON CONFLICT (dealership_id, ro_number)
    DO UPDATE SET washed_at = now(), washed_by = COALESCE(auth.uid(), public.car_washes.washed_by);

    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'washed',
      'Washed — moved from Wash to ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER parked_cars_record_wash
AFTER UPDATE ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.record_wash_on_leaving_wash();

CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
RETURNS pickup_requests
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_request public.pickup_requests;
  v_car public.parked_cars;
BEGIN
  SELECT * INTO v_request FROM public.pickup_requests WHERE id = _pickup_id AND status = 'unclaimed' FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Pickup is no longer available'; END IF;

  IF v_request.ro_number IS NOT NULL THEN
    SELECT * INTO v_car FROM public.parked_cars WHERE dealership_id = v_request.dealership_id AND ro_number = v_request.ro_number FOR UPDATE;
  END IF;

  UPDATE public.pickup_requests
  SET status = 'claimed', claimed_by = auth.uid(), claimed_at = now(),
      lot_position = COALESCE(v_car.lot_position, v_request.lot_position, 'UNKNOWN'),
      car_model = COALESCE(v_car.car_model, v_request.car_model)
  WHERE id = v_request.id RETURNING * INTO v_request;

  IF v_car.id IS NOT NULL AND v_request.kind NOT IN ('parts', 'shuttle') THEN
    IF v_request.kind = 'wash' THEN
      UPDATE public.parked_cars SET lot_position = 'WASH' WHERE id = v_car.id;
    ELSIF v_request.is_staged THEN
      UPDATE public.parked_cars SET lot_position = 'CP', is_staged = false WHERE id = v_car.id;
    ELSIF v_request.source_role IN ('Technician', 'Shop Foreman') THEN
      UPDATE public.parked_cars SET lot_position = 'BAY', notes = CASE WHEN v_request.advisor_name IS NULL OR v_request.advisor_name = '' THEN notes ELSE 'Bay — ' || v_request.advisor_name END WHERE id = v_car.id;
    ELSE
      UPDATE public.parked_cars SET lot_position = 'UNKNOWN' WHERE id = v_car.id;
    END IF;
  END IF;

  RETURN v_request;
END;$$;

CREATE OR REPLACE FUNCTION public.validate_spot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v text;
  n int;
BEGIN
  IF NEW.lot_position IS NULL OR btrim(NEW.lot_position) = '' THEN
    NEW.lot_position := 'UNKNOWN';
    RETURN NEW;
  END IF;

  v := upper(btrim(NEW.lot_position));
  v := regexp_replace(v, '^SV[[:space:]]*', 'SV ');
  NEW.lot_position := v;

  IF v IN ('UNKNOWN', 'CP', 'BL', 'BAY', 'WASH') THEN
    RETURN NEW;
  END IF;

  IF v ~ '^SV [0-9]+$' THEN
    n := substring(v from 4)::int;
    IF n < 1 OR n > 147 THEN
      RAISE EXCEPTION 'SV spot must be 1..147, got %', n;
    END IF;
    NEW.lot_position := 'SV ' || n::text;
    RETURN NEW;
  END IF;

  IF length(v) > 60 THEN
    RAISE EXCEPTION 'Location must be 60 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;