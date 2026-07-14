
-- 1) Rename dealership
UPDATE public.dealerships
SET name = 'Ontario JCD'
WHERE name = 'Ontario Jeep Chrysler Dodge Ram Fiat';

-- 2) Extend spot validator to allow C1..C36 (Lot 1) plus existing 0..147 (Lot 2) or UNKNOWN
CREATE OR REPLACE FUNCTION public.validate_spot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v text;
  n int;
BEGIN
  IF NEW.lot_position IS NULL OR NEW.lot_position = '' THEN
    NEW.lot_position := 'UNKNOWN';
    RETURN NEW;
  END IF;

  v := upper(NEW.lot_position);
  NEW.lot_position := v;

  IF v = 'UNKNOWN' THEN
    RETURN NEW;
  END IF;

  -- Lot 1: C1..C36
  IF v ~ '^C[0-9]+$' THEN
    n := substring(v FROM 2)::int;
    IF n < 1 OR n > 36 THEN
      RAISE EXCEPTION 'Lot 1 spot must be C1..C36, got %', v;
    END IF;
    RETURN NEW;
  END IF;

  -- Lot 2: 0..147 (0 = off-lot)
  IF v ~ '^[0-9]+$' THEN
    n := v::int;
    IF n < 0 OR n > 147 THEN
      RAISE EXCEPTION 'Lot 2 spot must be 0..147, got %', v;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Spot must be 0-147, C1-C36, or UNKNOWN, got %', NEW.lot_position;
END;
$$;
