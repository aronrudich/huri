CREATE TABLE public.business_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) <= 254),
  business_name text NOT NULL CHECK (length(business_name) <= 160),
  business_type text NOT NULL CHECK (business_type IN ('dealership','auction')),
  message text CHECK (length(message) <= 3000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','onboarding_sent','onboarding_started','submitted_for_review','approved','declined')),
  submission_key text UNIQUE,
  email_notification_sent_at timestamptz,
  email_notification_error text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.business_inquiries TO authenticated;
GRANT ALL ON public.business_inquiries TO service_role;
ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Huri support reads inquiries" ON public.business_inquiries FOR SELECT TO authenticated USING (private.is_huri_support(auth.uid()));
CREATE POLICY "Huri support updates inquiries" ON public.business_inquiries FOR UPDATE TO authenticated USING (private.is_huri_support(auth.uid())) WITH CHECK (private.is_huri_support(auth.uid()));
CREATE TRIGGER business_inquiries_touch BEFORE UPDATE ON public.business_inquiries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX business_inquiries_created_idx ON public.business_inquiries (created_at DESC);