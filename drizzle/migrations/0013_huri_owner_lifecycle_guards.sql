CREATE TABLE public.company_owner_grants (user_id uuid PRIMARY KEY, dealership_id uuid NOT NULL REFERENCES public.dealerships(id), granted_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.company_owner_grants TO authenticated;
GRANT ALL ON public.company_owner_grants TO service_role;
ALTER TABLE public.company_owner_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company ownership grants" ON public.company_owner_grants FOR SELECT TO authenticated USING (dealership_id = private.dealership_of(auth.uid()));
CREATE OR REPLACE FUNCTION public.provision_first_company_owner(_inquiry_id uuid,_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inq public.business_inquiries; p public.profiles;
BEGIN
 IF NOT private.is_huri_support(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT * INTO inq FROM public.business_inquiries WHERE id=_inquiry_id FOR UPDATE;
 IF inq.company_id IS NULL OR inq.activated_at IS NULL THEN RAISE EXCEPTION 'Company must be activated first'; END IF;
 PERFORM 1 FROM public.dealerships WHERE id=inq.company_id FOR UPDATE;
 SELECT * INTO p FROM public.profiles WHERE id=_user_id AND dealership_id=inq.company_id FOR UPDATE;
 IF p.id IS NULL OR NOT p.is_active THEN RAISE EXCEPTION 'An active account in this company is required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=_user_id AND lower(u.email)=lower(inq.email) AND u.email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'The confirmed account must match the approved business contact'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE dealership_id=inq.company_id AND is_owner) THEN RAISE EXCEPTION 'This company already has an owner'; END IF;
 INSERT INTO public.company_owner_grants(user_id,dealership_id,granted_by) VALUES(_user_id,inq.company_id,auth.uid());
 UPDATE public.profiles SET is_owner=true,status='approved' WHERE id=_user_id;
 INSERT INTO public.business_onboarding_activity(inquiry_id,actor_id,actor_label,section,summary) VALUES(_inquiry_id,auth.uid(),'Huri Support','owner_provisioned',jsonb_build_object('userId',_user_id));
END $$;
REVOKE ALL ON FUNCTION public.provision_first_company_owner(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provision_first_company_owner(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.transfer_company_ownership(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE company uuid;
BEGIN
 SELECT dealership_id INTO company FROM public.profiles WHERE id=auth.uid() AND is_owner AND is_active AND status='approved';
 IF company IS NULL THEN RAISE EXCEPTION 'Only the owner can transfer ownership'; END IF;
 PERFORM 1 FROM public.dealerships WHERE id=company FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND dealership_id=company AND is_owner AND is_active AND status='approved') THEN RAISE EXCEPTION 'Ownership changed; please refresh'; END IF;
 IF _user_id=auth.uid() THEN RAISE EXCEPTION 'Already the owner'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id AND dealership_id=company AND is_active AND status='approved' AND role_name<>'Spectator') THEN RAISE EXCEPTION 'Choose an active approved employee in your company'; END IF;
 DELETE FROM public.company_owner_grants WHERE dealership_id=company;
 INSERT INTO public.company_owner_grants(user_id,dealership_id,granted_by) VALUES(_user_id,company,auth.uid());
 UPDATE public.profiles SET is_owner=(id=_user_id) WHERE dealership_id=company AND (is_owner OR id=_user_id);
END $$;
REVOKE ALL ON FUNCTION public.transfer_company_ownership(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_company_ownership(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.protect_company_owner_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=OLD.id;
 IF p.is_owner THEN
  PERFORM 1 FROM public.dealerships WHERE id=p.dealership_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE dealership_id=p.dealership_id AND id<>OLD.id AND is_owner AND is_active AND status='approved') THEN RAISE EXCEPTION 'You must transfer ownership to another administrator before deleting your account.'; END IF;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER huri_protect_owner_deletion BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.protect_company_owner_deletion();