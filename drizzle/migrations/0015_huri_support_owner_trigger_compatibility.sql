CREATE OR REPLACE FUNCTION private.prevent_profile_self_escalation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF private.is_huri_support(auth.uid()) AND EXISTS (SELECT 1 FROM public.company_owner_grants WHERE user_id=NEW.id AND dealership_id=NEW.dealership_id) AND NEW.is_owner AND NEW.status='approved' AND NEW.role_name IS NOT DISTINCT FROM OLD.role_name AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id AND NEW.dealership_id IS NOT DISTINCT FROM OLD.dealership_id AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()=NEW.id AND NOT private.is_manager(auth.uid()) AND NOT private.is_owner(auth.uid()) THEN
 IF NEW.role_name IS DISTINCT FROM OLD.role_name OR NEW.role_id IS DISTINCT FROM OLD.role_id THEN RAISE EXCEPTION 'Not allowed: cannot change your own role'; END IF;
 IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN RAISE EXCEPTION 'Not allowed: cannot change your own active status'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Not allowed: cannot change your own approval status'; END IF;
 END IF;
 IF auth.uid() IS NOT NULL AND auth.uid()=NEW.id AND NOT private.is_owner(auth.uid()) AND NEW.dealership_id IS DISTINCT FROM OLD.dealership_id THEN RAISE EXCEPTION 'Not allowed: cannot change your own dealership'; END IF;
 IF auth.uid() IS NOT NULL AND NOT private.is_owner(auth.uid()) AND NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
 IF NOT (OLD.is_owner=false AND NEW.is_owner=true AND EXISTS(SELECT 1 FROM public.company_owner_grants WHERE user_id=NEW.id AND dealership_id=NEW.dealership_id AND granted_by=auth.uid()) AND private.is_upper_management(auth.uid())) THEN RAISE EXCEPTION 'Not allowed: only the owner can transfer ownership'; END IF;
 END IF;
 RETURN NEW;
END $$;