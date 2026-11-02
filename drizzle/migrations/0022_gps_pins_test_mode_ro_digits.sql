-- Widen RO format validation to 1-7 digit formats (legacy values accepted during transition)
CREATE OR REPLACE FUNCTION public.validate_company_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE day jsonb;
BEGIN
 IF NEW.shift_start_minutes NOT BETWEEN 0 AND 1439 OR NEW.ro_format NOT IN ('six_digits','flexible','digits_1','digits_2','digits_3','digits_4','digits_5','digits_6','digits_7') THEN RAISE EXCEPTION 'Invalid company configuration'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 IF jsonb_typeof(NEW.operating_hours) <> 'array' OR jsonb_array_length(NEW.operating_hours) <> 7 THEN RAISE EXCEPTION 'Hours must contain seven days'; END IF;
 FOR day IN SELECT value FROM jsonb_array_elements(NEW.operating_hours) LOOP
  IF day <> 'null'::jsonb THEN
   IF jsonb_typeof(day) <> 'object' OR jsonb_typeof(day->'open') IS DISTINCT FROM 'number' OR jsonb_typeof(day->'close') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid daily hours'; END IF;
   IF (day->>'open')::numeric <> trunc((day->>'open')::numeric) OR (day->>'close')::numeric <> trunc((day->>'close')::numeric) OR (day->>'open')::int < 0 OR (day->>'close')::int > 1439 OR (day->>'open')::int >= (day->>'close')::int THEN RAISE EXCEPTION 'Invalid daily hours'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;

-- Backfill legacy formats to the 6-digit default
UPDATE public.dealerships SET ro_format = 'digits_6' WHERE ro_format IN ('six_digits','flexible');
ALTER TABLE public.dealerships ALTER COLUMN ro_format SET DEFAULT 'digits_6';

-- Optional GPS pin coordinates for the private satellite-map test
ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS accuracy_ft integer;
ALTER TABLE public.parked_cars ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS accuracy_ft integer;
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone;

-- Silent test submissions: recorded normally, never alerted
ALTER TABLE public.pickup_requests ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;