CREATE OR REPLACE FUNCTION public.enforce_pickup_claim_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF; -- system jobs and service code
  IF TG_OP = 'INSERT' THEN
    IF NEW.claimed_by IS NULL AND NEW.claimed_at IS NULL THEN RETURN NEW; END IF;
    IF NEW.claimed_by = v_uid AND NEW.claimed_at IS NOT NULL
       AND abs(extract(epoch FROM (NEW.claimed_at - now()))) <= 120 THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Claim details can only be set by claiming the request';
  END IF;
  IF NEW.claimed_by IS NOT DISTINCT FROM OLD.claimed_by
     AND NEW.claimed_at IS NOT DISTINCT FROM OLD.claimed_at THEN RETURN NEW; END IF;
  IF private.is_upper_management(v_uid) THEN RETURN NEW; END IF;
  -- Releasing a claim (who may release is checked by the cancel-permissions trigger)
  IF NEW.claimed_by IS NULL AND NEW.claimed_at IS NULL THEN RETURN NEW; END IF;
  -- Claiming it yourself, right now
  IF NEW.claimed_by = v_uid AND NEW.claimed_at IS NOT NULL
     AND abs(extract(epoch FROM (NEW.claimed_at - now()))) <= 120 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Claim details can only change through Claim or Cancel claim';
END $$;

DROP TRIGGER IF EXISTS pickup_requests_enforce_claim_fields ON public.pickup_requests;
CREATE TRIGGER pickup_requests_enforce_claim_fields BEFORE INSERT OR UPDATE ON public.pickup_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_pickup_claim_fields();