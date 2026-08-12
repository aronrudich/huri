ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS reminded_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.archive_stale_pickups()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_moved boolean;
BEGIN
  FOR r IN
    SELECT id, ro_number, is_staged, kind, source_role, advisor_name, claimed_at
    FROM public.pickup_requests
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '20 minutes'
  LOOP
    UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = r.id;

    v_moved := false;
    IF r.ro_number IS NOT NULL AND r.claimed_at IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.parked_cars
        WHERE ro_number = r.ro_number
          AND lot_position <> 'UNKNOWN'
          AND located_at > r.claimed_at
      ) INTO v_moved;
    END IF;

    IF v_moved THEN
      CONTINUE;
    END IF;

    IF r.is_staged AND r.kind IS DISTINCT FROM 'parts' AND r.ro_number IS NOT NULL THEN
      UPDATE public.parked_cars
      SET lot_position = 'CP', is_staged = false
      WHERE ro_number = r.ro_number;
    ELSIF NOT r.is_staged
      AND r.kind IS DISTINCT FROM 'parts'
      AND r.ro_number IS NOT NULL
      AND r.source_role IN ('Technician', 'Shop Foreman')
    THEN
      UPDATE public.parked_cars
      SET lot_position = 'BAY',
          notes = CASE
            WHEN r.advisor_name IS NULL OR btrim(r.advisor_name) = '' THEN notes
            ELSE 'Bay — ' || r.advisor_name
          END
      WHERE ro_number = r.ro_number;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
 RETURNS pickup_requests
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.pickup_requests;
  v_car public.parked_cars;
  v_last timestamptz;
  v_wait int;
BEGIN
  SELECT max(claimed_at) INTO v_last
  FROM public.pickup_requests
  WHERE claimed_by = auth.uid();

  IF v_last IS NOT NULL AND v_last > now() - interval '2 minutes' THEN
    v_wait := ceil(extract(epoch from (v_last + interval '2 minutes' - now())));
    RAISE EXCEPTION 'You just claimed a request. Wait % more seconds before claiming another.', v_wait;
  END IF;

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
$function$;