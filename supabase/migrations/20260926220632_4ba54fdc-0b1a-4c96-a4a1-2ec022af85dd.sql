CREATE OR REPLACE FUNCTION public.car_events_from_parked_cars()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'logged',
      'Added to Huri at ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NULL, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'deleted',
      'Removed from Huri (was at ' || COALESCE(OLD.lot_position, 'UNKNOWN') || ')', NULL, auth.uid());
    RETURN OLD;
  ELSE
    IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'moved',
        COALESCE(OLD.lot_position, 'UNKNOWN') || ' → ' || COALESCE(NEW.lot_position, 'UNKNOWN'),
        NULL, auth.uid());
    END IF;
    IF NEW.is_staged IS DISTINCT FROM OLD.is_staged AND NEW.is_staged THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'staged', 'Marked as staged', NULL, auth.uid());
    END IF;
    IF NEW.tag_number IS DISTINCT FROM OLD.tag_number THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Tag # changed from ' || COALESCE(OLD.tag_number, '—') || ' to ' || COALESCE(NEW.tag_number, '—'),
        NULL, auth.uid());
    END IF;
    IF NEW.car_model IS DISTINCT FROM OLD.car_model THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Car changed from ' || COALESCE(OLD.car_model, '—') || ' to ' || COALESCE(NEW.car_model, '—'),
        NULL, auth.uid());
    END IF;
    IF NEW.ro_number IS DISTINCT FROM OLD.ro_number THEN
      PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'edited',
        'RO # changed to ' || COALESCE(NEW.ro_number, '—'), NULL, auth.uid());
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'RO # changed from ' || COALESCE(OLD.ro_number, '—'), NULL, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
END
$$;