CREATE OR REPLACE FUNCTION public.car_events_from_parked_cars()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'logged',
      'Added to Huri at ' || COALESCE(NEW.lot_position, 'UNKNOWN'), NEW.notes, COALESCE(auth.uid(), NEW.parked_by));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'deleted',
      'Removed from Huri (was at ' || COALESCE(OLD.lot_position, 'UNKNOWN') || ')', NULL, auth.uid());
    RETURN OLD;
  ELSE
    IF NEW.lot_position IS DISTINCT FROM OLD.lot_position THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'moved',
        'Location changed from ' || COALESCE(OLD.lot_position, 'UNKNOWN') || ' to ' || COALESCE(NEW.lot_position, 'UNKNOWN'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes AND NEW.notes IS NOT NULL AND btrim(NEW.notes) <> '' THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'note', 'Note updated', NEW.notes, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.is_staged IS DISTINCT FROM OLD.is_staged THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number,
        CASE WHEN NEW.is_staged THEN 'staged' ELSE 'unstaged' END,
        CASE WHEN NEW.is_staged THEN 'Marked as staged' ELSE 'Stage cleared' END,
        NULL, auth.uid());
    END IF;
    IF NEW.tag_number IS DISTINCT FROM OLD.tag_number THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Tag # changed from ' || COALESCE(OLD.tag_number, '—') || ' to ' || COALESCE(NEW.tag_number, '—'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.car_model IS DISTINCT FROM OLD.car_model THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'Car changed from ' || COALESCE(OLD.car_model, '—') || ' to ' || COALESCE(NEW.car_model, '—'),
        NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    IF NEW.ro_number IS DISTINCT FROM OLD.ro_number THEN
      PERFORM public.log_car_event(OLD.dealership_id, OLD.ro_number, 'edited',
        'RO # changed to ' || COALESCE(NEW.ro_number, '—'), NULL, COALESCE(auth.uid(), NEW.parked_by));
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'edited',
        'RO # changed from ' || COALESCE(OLD.ro_number, '—'), NULL, COALESCE(auth.uid(), NEW.parked_by));
    END IF;
    RETURN NEW;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.car_events_from_pickups()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_label text;
BEGIN
  v_label := CASE
    WHEN NEW.kind = 'parts' THEN 'Parts request'
    WHEN NEW.kind = 'shuttle' THEN 'Shuttle request'
    WHEN NEW.kind = 'park' THEN 'Park request'
    WHEN NEW.is_staged THEN 'Stage request'
    ELSE 'Pickup request'
  END;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'request',
      v_label || ' submitted' || COALESCE(' by ' || NEW.advisor_name, '')
      || COALESCE(' (' || NEW.source_role || ')', ''), NEW.car_notes, COALESCE(auth.uid(), NEW.requested_by));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'claimed' THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'claimed',
        v_label || ' claimed' || COALESCE(' (car was at ' || NEW.lot_position || ')', ''), NEW.car_notes, COALESCE(NEW.claimed_by, auth.uid()));
    ELSIF NEW.status = 'canceled' OR NEW.status = 'cancelled' THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'canceled', v_label || ' canceled', NULL, auth.uid());
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'completed', v_label || ' completed', NULL, COALESCE(NEW.claimed_by, auth.uid()));
    ELSE
      PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, NEW.status, v_label || ' → ' || NEW.status, NULL, auth.uid());
    END IF;
  END IF;

  IF NEW.reminded_at IS DISTINCT FROM OLD.reminded_at AND NEW.reminded_at IS NOT NULL THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'reminder',
      v_label || ' still unclaimed — valets notified again', NULL, NULL);
  END IF;

  IF NEW.car_notes IS DISTINCT FROM OLD.car_notes AND NEW.car_notes IS NOT NULL AND btrim(NEW.car_notes) <> '' THEN
    PERFORM public.log_car_event(NEW.dealership_id, NEW.ro_number, 'note',
      v_label || ' note updated', NEW.car_notes, auth.uid());
  END IF;

  RETURN NEW;
END $function$;

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
    SELECT id, ro_number, is_staged, kind, source_role, advisor_name, claimed_at, dealership_id
    FROM public.pickup_requests
    WHERE status = 'claimed'
      AND claimed_at <= now() - interval '20 minutes'
  LOOP
    UPDATE public.pickup_requests
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = r.id;

    PERFORM public.log_car_event(r.dealership_id, r.ro_number, 'archived',
      'Automatically archived 20 minutes after claim', NULL, NULL);

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