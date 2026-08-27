CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
 RETURNS pickup_requests
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    IF v_request.is_staged THEN
      UPDATE public.parked_cars SET lot_position = 'CP', is_staged = false WHERE id = v_car.id;
    ELSIF v_request.source_role IN ('Technician', 'Shop Foreman') THEN
      UPDATE public.parked_cars SET lot_position = 'BAY', notes = CASE WHEN v_request.advisor_name IS NULL OR v_request.advisor_name = '' THEN notes ELSE 'Bay — ' || v_request.advisor_name END WHERE id = v_car.id;
    ELSE
      UPDATE public.parked_cars SET lot_position = 'UNKNOWN' WHERE id = v_car.id;
    END IF;
  END IF;

  RETURN v_request;
END;$function$;