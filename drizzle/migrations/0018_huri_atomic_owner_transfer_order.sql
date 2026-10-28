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
 UPDATE public.profiles SET is_owner=true WHERE id=_user_id AND dealership_id=company;
 UPDATE public.profiles SET is_owner=false WHERE dealership_id=company AND id<>_user_id AND is_owner;
END $$;