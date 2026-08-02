CREATE OR REPLACE FUNCTION public.validate_spot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v text;
  n int;
BEGIN
  IF NEW.lot_position IS NULL OR btrim(NEW.lot_position) = '' THEN
    NEW.lot_position := 'T';
    RETURN NEW;
  END IF;

  v := upper(btrim(NEW.lot_position));
  NEW.lot_position := v;

  IF v IN ('UNKNOWN','T','C') THEN
    RETURN NEW;
  END IF;

  IF v ~ '^[0-9]+$' THEN
    n := v::int;
    IF n = 0 THEN
      NEW.lot_position := 'T';
      RETURN NEW;
    END IF;
    IF n < 1 OR n > 147 THEN
      RAISE EXCEPTION 'Lot 1 spot must be 1..147, got %', v;
    END IF;
    RETURN NEW;
  END IF;

  -- Anything else is a custom / special location. Keep it, capped at 60 chars.
  IF length(v) > 60 THEN
    RAISE EXCEPTION 'Location must be 60 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;