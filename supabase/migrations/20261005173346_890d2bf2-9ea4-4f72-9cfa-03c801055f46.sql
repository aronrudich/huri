CREATE TABLE public.business_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.business_inquiries(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  emailed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_onboarding_links TO authenticated;
GRANT ALL ON public.business_onboarding_links TO service_role;
ALTER TABLE public.business_onboarding_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Huri support reads links" ON public.business_onboarding_links FOR SELECT TO authenticated USING (private.is_huri_support(auth.uid()));
CREATE INDEX business_onboarding_links_inquiry_idx ON public.business_onboarding_links (inquiry_id, created_at DESC);

CREATE TABLE public.business_onboarding_drafts (
  inquiry_id uuid PRIMARY KEY REFERENCES public.business_inquiries(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_onboarding_drafts TO authenticated;
GRANT ALL ON public.business_onboarding_drafts TO service_role;
ALTER TABLE public.business_onboarding_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Huri support reads drafts" ON public.business_onboarding_drafts FOR SELECT TO authenticated USING (private.is_huri_support(auth.uid()));
CREATE TRIGGER business_onboarding_drafts_touch BEFORE UPDATE ON public.business_onboarding_drafts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();