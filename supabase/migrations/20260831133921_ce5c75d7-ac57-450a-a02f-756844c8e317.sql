CREATE OR REPLACE FUNCTION public.assign_lot_position(_target_id uuid, _ro_number text, _position text, _car_model text, _notes text, _confirm_displace boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_dealership uuid;
  v_pos text := upper(btrim(coalesce(_position, 'UNKNOWN')));
  v_placeholder boolean;
  v_target public.parked_cars;
  v_occupant public.parked_cars;
  v_id uuid;
BEGIN
  v_dealership := private.dealership_of(auth.uid());
  IF v_dealership IS NULL THEN RAISE EXCEPTION 'No dealership for this account'; END IF;
  IF NOT private.is_active_employee(auth.uid()) OR NOT private.is_approved(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_placeholder := v_pos IN ('BL', 'CP', 'UNKNOWN', 'BAY', 'WASH') OR v_pos !~ '^SV [0-9]+$';

  IF _target_id IS NOT NULL THEN
    SELECT * INTO v_target FROM public.parked_cars
      WHERE id = _target_id AND dealership_id = v_dealership FOR UPDATE;
  END IF;
  IF v_target.id IS NULL AND _ro_number IS NOT NULL AND btrim(_ro_number) <> '' THEN
    SELECT * INTO v_target FROM public.parked_cars
      WHERE dealership_id = v_dealership AND ro_number ILIKE btrim(_ro_number)
      ORDER BY created_at LIMIT 1 FOR UPDATE;
  END IF;

  IF NOT v_placeholder THEN
    SELECT * INTO v_occupant FROM public.parked_cars
      WHERE dealership_id = v_dealership AND upper(lot_position) = v_pos
        AND (v_target.id IS NULL OR id <> v_target.id)
      ORDER BY created_at LIMIT 1 FOR UPDATE;

    IF v_occupant.id IS NOT NULL AND NOT _confirm_displace THEN
      RETURN jsonb_build_object(
        'status', 'occupied',
        'occupant_ro', v_occupant.ro_number,
        'occupant_model', v_occupant.car_model
      );
    END IF;

    IF v_occupant.id IS NOT NULL THEN
      UPDATE public.parked_cars SET lot_position = 'UNKNOWN' WHERE id = v_occupant.id;
    END IF;
  END IF;

  IF v_target.id IS NOT NULL THEN
    UPDATE public.parked_cars
    SET ro_number = btrim(_ro_number),
        car_model = _car_model,
        lot_position = v_pos,
        notes = _notes,
        parked_by = coalesce(auth.uid(), parked_by)
    WHERE id = v_target.id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.parked_cars (ro_number, car_model, lot_position, notes, parked_by, dealership_id)
    VALUES (btrim(_ro_number), _car_model, v_pos, _notes, auth.uid(), v_dealership)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'id', v_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assign_lot_position(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_lot_position(uuid, text, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_pickup_request(_pickup_id uuid)
 RETURNS public.pickup_requests
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
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_pickup_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pickup_request(uuid) TO authenticated;