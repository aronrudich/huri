ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS eta_notified_at timestamptz;

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

  IF v_request.customer_eta IS NOT NULL AND v_request.customer_eta - interval '20 minutes' > now() THEN
    RAISE EXCEPTION 'This arrival opens 20 minutes before the customer''s time';
  END IF;

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
GRANT EXECUTE ON FUNCTION public.claim_pickup_request(uuid) TO authenticated, service_role;