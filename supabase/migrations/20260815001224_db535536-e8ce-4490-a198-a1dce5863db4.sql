CREATE TABLE public.car_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealership_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.dealerships(id),
  ro_number text,
  event_type text NOT NULL,
  detail text,
  notes text,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.car_events TO authenticated;
GRANT ALL ON public.car_events TO service_role;

ALTER TABLE public.car_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "car events readable by tenant" ON public.car_events
  FOR SELECT USING (dealership_id = private.dealership_of(auth.uid()));

CREATE POLICY "car events insert by active employees" ON public.car_events
  FOR INSERT TO authenticated WITH CHECK (private.is_active_employee(auth.uid()));

CREATE INDEX car_events_ro_idx ON public.car_events (ro_number, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_car_event(
  _dealership_id uuid, _ro text, _type text, _detail text, _notes text, _actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _ro IS NULL OR btrim(_ro) = '' THEN RETURN; END IF;
  INSERT INTO public.car_events (dealership_id, ro_number, event_type, detail, notes, actor_id)
  VALUES (COALESCE(_dealership_id, '00000000-0000-0000-0000-000000000001'::uuid), btrim(_ro), _type, _detail, _notes, _actor);
END $$;

CREATE OR REPLACE FUNCTION public.car_events_from_parked_cars()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER parked_cars_log_events
AFTER INSERT OR UPDATE OR DELETE ON public.parked_cars
FOR EACH ROW EXECUTE FUNCTION public.car_events_from_parked_cars();

CREATE OR REPLACE FUNCTION public.car_events_from_pickups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  RETURN NEW;
END $$;

CREATE TRIGGER pickup_requests_log_events
AFTER INSERT OR UPDATE ON public.pickup_requests
FOR EACH ROW EXECUTE FUNCTION public.car_events_from_pickups();