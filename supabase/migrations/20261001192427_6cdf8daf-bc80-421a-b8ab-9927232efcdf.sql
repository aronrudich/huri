CREATE TABLE public.milestone_fired (key text PRIMARY KEY, fired_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.milestone_fired TO service_role;
ALTER TABLE public.milestone_fired ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.alex_1000_claims_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_alex constant uuid := '2bce037a-f670-47d0-a06f-8d1460bd7022';
  v_count int;
  v_inserted int;
  v_body constant text := '[[celebrate]]WOW! Alex has officially hit 1000 claims! He sure knows to Huri the f*ck up! Thank you Alex!';
BEGIN
  IF NEW.claimed_by IS DISTINCT FROM v_alex THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.claimed_by IS NOT DISTINCT FROM v_alex THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.milestone_fired WHERE key = 'alex-1000') THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.pickup_requests WHERE claimed_by = v_alex;
  IF v_count < 1000 THEN RETURN NEW; END IF;

  INSERT INTO public.milestone_fired (key) VALUES ('alex-1000') ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.messages (thread_id, sender_id, recipient_id, body, dealership_id)
  SELECT 'huri:milestone-alex-1000:' || p.id, NULL, p.id, v_body, p.dealership_id
  FROM public.profiles p
  WHERE p.dealership_id = NEW.dealership_id AND p.is_active AND p.status = 'approved'
    AND (p.role_name IN ('Valet', 'Service Manager', 'Admin') OR p.id = v_alex);

  BEGIN
    PERFORM net.http_post(
      url := 'https://project--7a2bc1d9-d11a-4987-b046-aa093d085a42.lovable.app/api/public/hooks/milestone',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'REMOVED'),
      body := '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.alex_1000_claims_milestone() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pickup_requests_alex_1000
AFTER INSERT OR UPDATE OF claimed_by ON public.pickup_requests
FOR EACH ROW EXECUTE FUNCTION public.alex_1000_claims_milestone();