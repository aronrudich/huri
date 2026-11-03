CREATE OR REPLACE FUNCTION public.switch_active_dealership(_dealership_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF NOT private.is_huri_support(auth.uid()) OR NOT private.is_approved(auth.uid()) OR private.is_spectator(auth.uid()) THEN RAISE EXCEPTION 'Huri Support only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.dealerships WHERE id=_dealership_id) THEN RAISE EXCEPTION 'Company not found'; END IF;
 PERFORM set_config('huri.support_switch',_dealership_id::text,true);
 UPDATE public.profiles SET dealership_id=_dealership_id WHERE id=auth.uid();
 RETURN _dealership_id;
END $$;
REVOKE ALL ON FUNCTION public.switch_active_dealership(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.switch_active_dealership(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.allow_verified_support_switch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF NEW.dealership_id IS DISTINCT FROM OLD.dealership_id AND auth.uid()=NEW.id AND private.is_huri_support(auth.uid()) AND current_setting('huri.support_switch',true)=NEW.dealership_id::text THEN
  IF NEW.role_name IS DISTINCT FROM OLD.role_name OR NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.status IS DISTINCT FROM OLD.status OR NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN RAISE EXCEPTION 'Switch cannot change privileges'; END IF;
 END IF;
 RETURN NEW;
END $$;