ALTER TABLE public.dealerships ADD COLUMN IF NOT EXISTS operating_hours jsonb NOT NULL DEFAULT '[null,{"open":390,"close":1080},{"open":390,"close":1080},{"open":390,"close":1080},{"open":390,"close":1080},{"open":390,"close":1080},{"open":480,"close":960}]'::jsonb;
ALTER TABLE public.dealerships ADD COLUMN IF NOT EXISTS shift_start_minutes integer NOT NULL DEFAULT 390;
ALTER TABLE public.dealerships ADD COLUMN IF NOT EXISTS ro_format text NOT NULL DEFAULT 'six_digits';
CREATE OR REPLACE FUNCTION public.validate_company_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE day jsonb;
BEGIN
 IF NEW.shift_start_minutes NOT BETWEEN 0 AND 1439 OR NEW.ro_format NOT IN ('six_digits','flexible') THEN RAISE EXCEPTION 'Invalid company configuration'; END IF;
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
CREATE TRIGGER validate_company_configuration BEFORE INSERT OR UPDATE ON public.dealerships FOR EACH ROW EXECUTE FUNCTION public.validate_company_configuration();