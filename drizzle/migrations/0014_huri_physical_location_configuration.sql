CREATE TABLE public.company_location_rules (dealership_id uuid NOT NULL REFERENCES public.dealerships(id), label text NOT NULL, lot_name text NOT NULL DEFAULT 'Lot', capacity integer NOT NULL DEFAULT 1, blockers text[] NOT NULL DEFAULT '{}', PRIMARY KEY(dealership_id,label));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.company_location_rules TO authenticated;
GRANT ALL ON public.company_location_rules TO service_role;
ALTER TABLE public.company_location_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads location rules" ON public.company_location_rules FOR SELECT TO authenticated USING(dealership_id=private.dealership_of(auth.uid()) AND private.is_approved(auth.uid()));
CREATE POLICY "management edits location rules" ON public.company_location_rules FOR ALL TO authenticated USING(dealership_id=private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()) AND NOT private.is_spectator(auth.uid())) WITH CHECK(dealership_id=private.dealership_of(auth.uid()) AND private.is_upper_management(auth.uid()) AND NOT private.is_spectator(auth.uid()));
CREATE OR REPLACE FUNCTION public.validate_location_rule() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.label=upper(btrim(NEW.label));
 IF length(NEW.label) NOT BETWEEN 1 AND 60 OR NEW.capacity NOT IN (0,1) OR NEW.label IN ('UNKNOWN','TAKEN','BAY','WASH','CP','BL') THEN RAISE EXCEPTION 'Choose a physical spot or custom shared-area label'; END IF;
 IF cardinality(NEW.blockers)>20 OR NEW.label=ANY(NEW.blockers) THEN RAISE EXCEPTION 'Invalid blocking relationship'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(NEW.blockers) b WHERE b<>upper(btrim(b)) OR length(b) NOT BETWEEN 1 AND 60) THEN RAISE EXCEPTION 'Blocker labels must be normalized'; END IF;
 PERFORM 1 FROM public.dealerships WHERE id=NEW.dealership_id FOR UPDATE;
 IF NEW.capacity=1 AND (SELECT count(*) FROM public.parked_cars WHERE dealership_id=NEW.dealership_id AND upper(btrim(lot_position))=NEW.label)>1 THEN RAISE EXCEPTION 'This spot has multiple cars; resolve occupancy before making it exclusive'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_location_rule BEFORE INSERT OR UPDATE ON public.company_location_rules FOR EACH ROW EXECUTE FUNCTION public.validate_location_rule();
CREATE OR REPLACE FUNCTION public.is_physical_company_spot(_company uuid,_label text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.company_location_rules WHERE dealership_id=_company AND label=upper(btrim(_label)) AND capacity=1)
 OR (EXISTS(SELECT 1 FROM public.dealerships WHERE id=_company AND company_code='JCD29854') AND upper(btrim(_label)) ~ '^SV ([1-9]|[1-9][0-9]|1[0-3][0-9]|14[0-7])$')
$$;
CREATE OR REPLACE FUNCTION public.validate_spot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text; n numeric;
BEGIN
 v=upper(btrim(coalesce(nullif(btrim(NEW.lot_position),''),'UNKNOWN')));
 v=regexp_replace(v,'^SV[[:space:]]*','SV ');
 IF length(v)>60 THEN RAISE EXCEPTION 'Location must be 60 characters or fewer'; END IF;
 IF v ~ '^SV [0-9]+$' THEN n=substring(v from 4)::numeric; IF n<1 THEN RAISE EXCEPTION 'Spot number must be positive'; END IF; v='SV '||n::text; END IF;
 NEW.lot_position=v;
 IF public.is_physical_company_spot(NEW.dealership_id,v) THEN
  PERFORM 1 FROM public.dealerships WHERE id=NEW.dealership_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.parked_cars WHERE dealership_id=NEW.dealership_id AND upper(btrim(lot_position))=v AND id<>NEW.id) THEN RAISE EXCEPTION 'This physical spot is already occupied'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.assign_lot_position(_target_id uuid,_ro_number text,_position text,_car_model text,_notes text,_confirm_displace boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,private AS $$
DECLARE company uuid; pos text=upper(btrim(coalesce(_position,'UNKNOWN'))); target public.parked_cars; occupant public.parked_cars; result uuid;
BEGIN
 company=private.dealership_of(auth.uid());
 IF company IS NULL OR NOT private.is_active_employee(auth.uid()) OR NOT private.is_approved(auth.uid()) OR private.is_spectator(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 PERFORM 1 FROM public.dealerships WHERE id=company FOR UPDATE;
 IF _target_id IS NOT NULL THEN SELECT * INTO target FROM public.parked_cars WHERE id=_target_id AND dealership_id=company FOR UPDATE; END IF;
 IF target.id IS NULL AND nullif(btrim(_ro_number),'') IS NOT NULL THEN SELECT * INTO target FROM public.parked_cars WHERE dealership_id=company AND lower(btrim(ro_number))=lower(btrim(_ro_number)) ORDER BY created_at LIMIT 1 FOR UPDATE; END IF;
 IF public.is_physical_company_spot(company,pos) THEN
  SELECT * INTO occupant FROM public.parked_cars WHERE dealership_id=company AND upper(btrim(lot_position))=pos AND (target.id IS NULL OR id<>target.id) ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF occupant.id IS NOT NULL AND NOT _confirm_displace THEN RETURN jsonb_build_object('status','occupied','occupant_ro',occupant.ro_number,'occupant_model',occupant.car_model); END IF;
  IF occupant.id IS NOT NULL THEN UPDATE public.parked_cars SET lot_position='UNKNOWN' WHERE id=occupant.id; END IF;
 END IF;
 IF target.id IS NOT NULL THEN
 UPDATE public.parked_cars SET ro_number=btrim(_ro_number),car_model=coalesce(nullif(btrim(_car_model),''),target.car_model),lot_position=pos,notes=coalesce(_notes,target.notes),parked_by=auth.uid() WHERE id=target.id RETURNING id INTO result;
 ELSE INSERT INTO public.parked_cars(ro_number,car_model,lot_position,notes,parked_by,dealership_id) VALUES(btrim(_ro_number),_car_model,pos,_notes,auth.uid(),company) RETURNING id INTO result; END IF;
 RETURN jsonb_build_object('status','ok','id',result);
END $$;
CREATE OR REPLACE FUNCTION public.record_wash_on_leaving_wash() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF upper(btrim(OLD.lot_position))='WASH' AND upper(btrim(NEW.lot_position)) NOT IN ('WASH','TAKEN','UNKNOWN','BAY') AND NEW.ro_number IS NOT NULL AND btrim(NEW.ro_number)<>'' AND current_setting('huri.system_move',true) IS DISTINCT FROM 'on'
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND dealership_id=NEW.dealership_id AND role_name='Car Wash' AND is_active AND status='approved') THEN
 INSERT INTO public.car_washes(dealership_id,ro_number,washed_at,washed_by) VALUES(NEW.dealership_id,btrim(NEW.ro_number),now(),auth.uid()) ON CONFLICT(dealership_id,ro_number) DO UPDATE SET washed_at=now(),washed_by=auth.uid();
 PERFORM public.log_car_event(NEW.dealership_id,NEW.ro_number,'washed','Washed — moved from Wash to '||NEW.lot_position,NULL,auth.uid());
 END IF; RETURN NEW;
END $$;