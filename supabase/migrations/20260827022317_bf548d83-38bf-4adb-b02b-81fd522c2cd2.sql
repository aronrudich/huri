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
  v_dest text;
BEGIN
  SELECT max(claimed_at) INTO v_last
  FROM public.pickup_requests
  WHERE claimed_by = auth.uid();

  IF v_last IS NOT NULL AND v_last > now() - interval '1 minute' THEN
    v_wait := ceil(extract(epoch from (v_last + interval '1 minute' - now())));
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

  -- The car moves to its destination immediately; the request keeps the snapshot
  -- of where the car was so valets can still find it.
  IF v_car.id IS NOT NULL AND v_request.kind IS DISTINCT FROM 'parts' AND v_request.kind IS DISTINCT FROM 'shuttle' THEN
    IF v_request.is_staged THEN
      UPDATE public.parked_cars
      SET lot_position = 'CP', is_staged = false
      WHERE id = v_car.id;
    ELSIF v_request.source_role IN ('Technician', 'Shop Foreman') THEN
      UPDATE public.parked_cars
      SET lot_position = 'BAY',
          notes = CASE
            WHEN v_request.advisor_name IS NULL OR btrim(v_request.advisor_name) = '' THEN notes
            ELSE 'Bay — ' || v_request.advisor_name
          END
      WHERE id = v_car.id;
    ELSE
      UPDATE public.parked_cars
      SET lot_position = 'UNKNOWN'
      WHERE id = v_car.id;
    END IF;
  END IF;

  RETURN v_request;
END;
$function$;

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
    SELECT id, ro_number, dealership_id
    FROM public.pickup_requests
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '20 minutes'
  LOOP
    UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = r.id;

    PERFORM public.log_car_event(r.dealership_id, r.ro_number, 'archived',
      'Automatically archived 20 minutes after claim', NULL, NULL);
  END LOOP;
END;
$function$;