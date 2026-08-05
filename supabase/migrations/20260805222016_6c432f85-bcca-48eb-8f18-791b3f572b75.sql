DROP INDEX IF EXISTS public.parked_cars_unique_real_spot;
DROP INDEX IF EXISTS public.parked_cars_unique_spot;

ALTER TABLE public.parked_cars
  ADD COLUMN IF NOT EXISTS located_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stale_alerted_at timestamptz;

UPDATE public.parked_cars
SET lot_position = CASE
  WHEN upper(btrim(lot_position)) ~ '^[0-9]+$' THEN 'SV ' || (upper(btrim(lot_position))::int)::text
  WHEN upper(btrim(lot_position)) = 'C' THEN 'CP'
  WHEN upper(btrim(lot_position)) = 'T' THEN 'BL'
  ELSE upper(btrim(lot_position))
END;

UPDATE public.pickup_requests
SET lot_position = CASE
  WHEN lot_position IS NULL THEN NULL
  WHEN upper(btrim(lot_position)) ~ '^[0-9]+$' THEN 'SV ' || (upper(btrim(lot_position))::int)::text
  WHEN upper(btrim(lot_position)) = 'C' THEN 'CP'
  WHEN upper(btrim(lot_position)) = 'T' THEN 'BL'
  ELSE upper(btrim(lot_position))
END;

CREATE OR REPLACE FUNCTION public.validate_spot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

  IF v IN ('UNKNOWN', 'CP', 'BL') THEN
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

CREATE UNIQUE INDEX parked_cars_unique_sv_spot
  ON public.parked_cars (dealership_id, upper(lot_position))
  WHERE upper(lot_position) ~ '^SV ([1-9]|[1-9][0-9]|1[0-3][0-9]|14[0-7])$';

CREATE OR REPLACE FUNCTION public.track_car_location_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
    NEW.located_at := now();
    NEW.stale_alerted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parked_cars_track_location_age ON public.parked_cars;
CREATE TRIGGER parked_cars_track_location_age
BEFORE UPDATE OF lot_position ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.track_car_location_age();

CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
RETURNS public.pickup_requests
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_request public.pickup_requests;
  v_car public.parked_cars;
BEGIN
  SELECT * INTO v_request
  FROM public.pickup_requests
  WHERE id = _pickup_id AND status = 'unclaimed'
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Pickup is no longer available';
  END IF;

  IF v_request.ro_number IS NOT NULL THEN
    SELECT * INTO v_car
    FROM public.parked_cars
    WHERE dealership_id = v_request.dealership_id
      AND ro_number = v_request.ro_number
    FOR UPDATE;
  END IF;

  UPDATE public.pickup_requests
  SET status = 'claimed',
      claimed_by = auth.uid(),
      claimed_at = now(),
      lot_position = COALESCE(v_car.lot_position, v_request.lot_position, 'UNKNOWN'),
      car_model = COALESCE(v_car.car_model, v_request.car_model),
      car_notes = COALESCE(v_car.notes, v_request.car_notes)
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  IF v_car.id IS NOT NULL THEN
    UPDATE public.parked_cars
    SET lot_position = 'UNKNOWN'
    WHERE id = v_car.id;
  END IF;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pickup_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pickup_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pickup_request(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pickup_requests
  SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE status = 'claimed'
    AND claimed_at <= now() - interval '60 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.archive_stale_pickups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_stale_pickups() TO service_role;