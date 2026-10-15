CREATE OR REPLACE FUNCTION public.enforce_pickup_cancel_permissions()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF; -- system jobs
  -- Unclaiming: only the person who claimed it (or upper management).
  IF OLD.status = 'claimed' AND NEW.status = 'unclaimed' THEN
    IF OLD.claimed_by = v_uid OR private.is_upper_management(v_uid) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'You can only cancel your own claim';
  END IF;
  IF NEW.status NOT IN ('canceled','cancelled') OR OLD.status IN ('canceled','cancelled') THEN RETURN NEW; END IF;
  SELECT role_name INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IN ('Valet','Valet Supervisor') THEN
    RAISE EXCEPTION 'Valets can only cancel their claim, not the whole request';
  END IF;
  IF private.is_upper_management(v_uid) THEN RETURN NEW; END IF;
  IF v_role IN ('Technician','Shop Foreman') THEN
    IF OLD.requested_by = v_uid AND OLD.status = 'unclaimed' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'You can only cancel your own submission before it is claimed';
  ELSE
    IF OLD.requested_by = v_uid THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'You can only cancel your own submissions';
  END IF;
END $function$;