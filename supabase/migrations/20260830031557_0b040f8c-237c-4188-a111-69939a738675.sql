-- 1. Approved + active checks on tenant-scoped reads
DROP POLICY IF EXISTS "parked_cars readable by tenant" ON public.parked_cars;
CREATE POLICY "parked_cars readable by tenant" ON public.parked_cars
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));

DROP POLICY IF EXISTS "pickups readable by tenant" ON public.pickup_requests;
CREATE POLICY "pickups readable by tenant" ON public.pickup_requests
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));

DROP POLICY IF EXISTS "car events readable by tenant" ON public.car_events;
CREATE POLICY "car events readable by tenant" ON public.car_events
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));

DROP POLICY IF EXISTS "car washes readable by tenant" ON public.car_washes;
CREATE POLICY "car washes readable by tenant" ON public.car_washes
FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));

-- 2. Writes scoped to the caller's dealership + approved
DROP POLICY IF EXISTS "parked_cars insert by active employees" ON public.parked_cars;
CREATE POLICY "parked_cars insert by active employees" ON public.parked_cars
FOR INSERT TO authenticated
WITH CHECK (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
            AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "parked_cars update by active employees" ON public.parked_cars;
CREATE POLICY "parked_cars update by active employees" ON public.parked_cars
FOR UPDATE TO authenticated
USING (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
       AND dealership_id = private.dealership_of(auth.uid()))
WITH CHECK (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
            AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "parked_cars delete by active employees" ON public.parked_cars;
CREATE POLICY "parked_cars delete by active employees" ON public.parked_cars
FOR DELETE TO authenticated
USING (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
       AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "pickups insert by active employees" ON public.pickup_requests;
CREATE POLICY "pickups insert by active employees" ON public.pickup_requests
FOR INSERT TO authenticated
WITH CHECK (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
            AND dealership_id = private.dealership_of(auth.uid()));

DROP POLICY IF EXISTS "pickups update by active employees" ON public.pickup_requests;
CREATE POLICY "pickups update by active employees" ON public.pickup_requests
FOR UPDATE TO authenticated
USING (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
       AND dealership_id = private.dealership_of(auth.uid()))
WITH CHECK (private.is_active_employee(auth.uid()) AND private.is_approved(auth.uid())
            AND dealership_id = private.dealership_of(auth.uid()));

-- 3. Self-escalation guard: dealership_id
CREATE OR REPLACE FUNCTION private.prevent_profile_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id AND NOT private.is_manager(auth.uid()) AND NOT private.is_owner(auth.uid()) THEN
    IF NEW.role_name IS DISTINCT FROM OLD.role_name THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own role';
    END IF;
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own active status';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Not allowed: cannot change your own approval status';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.id AND NOT private.is_owner(auth.uid())
     AND NEW.dealership_id IS DISTINCT FROM OLD.dealership_id THEN
    RAISE EXCEPTION 'Not allowed: cannot change your own dealership';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT private.is_owner(auth.uid()) AND NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
    RAISE EXCEPTION 'Not allowed: only the owner can transfer ownership';
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND NOT (is_owner IS DISTINCT FROM (SELECT p.is_owner FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (dealership_id IS DISTINCT FROM (SELECT p.dealership_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND (
    private.is_manager(auth.uid()) OR private.is_owner(auth.uid())
    OR (
      NOT (role_name IS DISTINCT FROM (SELECT p.role_name FROM public.profiles p WHERE p.id = auth.uid()))
      AND NOT (is_active IS DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
      AND NOT (status IS DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid()))
    )
  )
);

-- 4. push_subscriptions UPDATE policy (needed for upsert on endpoint)
DROP POLICY IF EXISTS "push own update" ON public.push_subscriptions;
CREATE POLICY "push own update" ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. Atomic numbered-spot assignment
CREATE OR REPLACE FUNCTION public.assign_lot_position(
  _target_id uuid,
  _ro_number text,
  _position text,
  _car_model text,
  _notes text,
  _confirm_displace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
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

  -- Resolve the row we are writing: explicit id, else an existing car with this RO.
  IF _target_id IS NOT NULL THEN
    SELECT * INTO v_target FROM public.parked_cars
      WHERE id = _target_id AND dealership_id = v_dealership FOR UPDATE;
  END IF;
  IF v_target.id IS NULL AND _ro_number IS NOT NULL AND btrim(_ro_number) <> '' THEN
    SELECT * INTO v_target FROM public.parked_cars
      WHERE dealership_id = v_dealership AND ro_number ILIKE btrim(_ro_number)
      ORDER BY created_at LIMIT 1 FOR UPDATE;
  END IF;

  -- Numbered spots hold one car; lock the occupant and require confirmation.
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

GRANT EXECUTE ON FUNCTION public.assign_lot_position(uuid, text, text, text, text, boolean) TO authenticated;

-- 6. Indexes for RLS filters
CREATE INDEX IF NOT EXISTS idx_parked_cars_dealership ON public.parked_cars (dealership_id);
CREATE INDEX IF NOT EXISTS idx_pickup_requests_dealership ON public.pickup_requests (dealership_id);
CREATE INDEX IF NOT EXISTS idx_messages_dealership ON public.messages (dealership_id);

-- 7. Realtime replica identity
ALTER TABLE public.parked_cars REPLICA IDENTITY FULL;
ALTER TABLE public.pickup_requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;